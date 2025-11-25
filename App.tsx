import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { QuotationData, Client, StoredProduct, ProductItem } from './types';
import { DEFAULT_TERMS, DEFAULT_BANK_DETAILS } from './constants';
import QuotationPreview from './components/QuotationPreview';
import QuotationHistory from './components/QuotationHistory';
import ProductList from './components/ProductList';
import { generatePdf } from './services/pdfGenerator';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useDebounce } from './hooks/useDebounce';
import { backgroundPattern } from './assets/backgroundPattern';
import { saveQuotationToFirebase, loadQuotationsFromFirebase, deleteQuotationFromFirebase } from './services/firebaseService';

const formatRefNo = (num: number) => `SMQ ${String(num).padStart(3, '0')}`;

const App: React.FC = () => {
    const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
    const [products, setProducts] = useLocalStorage<StoredProduct[]>('products', []);
    const [lastRefNo, setLastRefNo] = useLocalStorage<number>('lastRefNo', 71);
    const [history, setHistory] = useState<QuotationData[]>([]);
    
    const [activeMobileView, setActiveMobileView] = useState<'form' | 'rightPanel'>('form');
    const [activeRightPanel, setActiveRightPanel] = useState<'preview' | 'history' | 'list'>('preview');

    const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
    const [productSuggestions, setProductSuggestions] = useState<StoredProduct[]>([]);
    const [activeSuggestionBox, setActiveSuggestionBox] = useState<string | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [copiedProduct, setCopiedProduct] = useState<StoredProduct | null>(null);
    const prevQuotationDataRef = useRef<QuotationData | undefined>(undefined);


    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Only load from files if localStorage is empty to not overwrite user's work
                const localClients = JSON.parse(localStorage.getItem('clients') || '[]');
                if (localClients.length === 0) {
                    const res = await fetch('/clients.json');
                    if (res.ok) {
                        const data = await res.json();
                        setClients(data);
                    }
                }

                const localProducts = JSON.parse(localStorage.getItem('products') || '[]');
                if (localProducts.length === 0) {
                    const res = await fetch('/products.json');
                     if (res.ok) {
                        const data = await res.json();
                        setProducts(data);
                    }
                }
            } catch (error) {
                console.error("Error loading initial data from JSON files:", error);
            } finally {
                setIsDataLoaded(true);
            }
        };
        loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const loadHistoryFromFirebase = async () => {
            try {
                const quotations = await loadQuotationsFromFirebase(100);
                const formattedQuotations = quotations.map(q => {
                    const { createdAt, ...rest } = q;
                    return rest;
                });
                setHistory(formattedQuotations);
            } catch (error) {
                console.error("Error loading quotation history from Firebase:", error);
            }
        };
        loadHistoryFromFirebase();
    }, []);


    const getInitialState = useCallback((currentLastRef: number): Omit<QuotationData, 'logo' | 'signature' | 'stamp' | 'status'> => ({
        refNo: formatRefNo(currentLastRef + 1),
        date: new Date().toISOString().split('T')[0],
        client: { name: '', address: '', gst: '' },
        subject: '',
        products: [{ id: crypto.randomUUID(), name: '', model: '', features: '', quantity: 1, rate: 0, gstRate: 12 }],
        terms: DEFAULT_TERMS,
        bankDetails: DEFAULT_BANK_DETAILS,
        freight: 0,
        freightGstRate: 18,
        totalDiscountAmount: 0,
    }), []);

    const [quotationData, setQuotationData] = useState<QuotationData>(() => ({
        ...getInitialState(lastRefNo),
        logo: null,
        signature: null,
        stamp: null,
        status: 'draft',
    }));
    
    const debouncedQuotationData = useDebounce(quotationData, 2000);
    
    // Auto-generate subject when product names change
    const productNamesString = useMemo(() => JSON.stringify(quotationData.products.map(p => p.name)), [quotationData.products]);
    useEffect(() => {
        const productNames = quotationData.products
            .map(p => p.name)
            .filter(name => name && name.trim() !== '');
        
        const newSubject = productNames.length > 0
            ? `Reg. Price Quotation for ${productNames.join(' and ')}.`
            : '';
            
        setQuotationData(prev => ({ ...prev, subject: newSubject }));
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productNamesString]);


    // Effect for AUTOSAVING client to localStorage
    useEffect(() => {
        if (!isDataLoaded || !debouncedQuotationData || JSON.stringify(debouncedQuotationData) === JSON.stringify(prevQuotationDataRef.current)) {
            return;
        }

        // Save/Update client from form
        const currentClient = debouncedQuotationData.client;
        if (currentClient.name) {
            setClients(prevClients => {
                const clientIndex = prevClients.findIndex(c => c.name.toLowerCase() === currentClient.name.toLowerCase());
                const newClients = [...prevClients];
                if (clientIndex > -1) {
                    if(JSON.stringify(newClients[clientIndex]) !== JSON.stringify(currentClient)){
                        newClients[clientIndex] = currentClient; // Update
                        return newClients;
                    }
                } else {
                    newClients.push(currentClient); // Add
                    return newClients;
                }
                return prevClients;
            });
        }
        
        prevQuotationDataRef.current = debouncedQuotationData;

    }, [debouncedQuotationData, isDataLoaded, setClients]);
    
    // Effect for AUTOSAVING products to localStorage
    useEffect(() => {
        if (!isDataLoaded || !debouncedQuotationData) {
            return;
        }

        setProducts(prevProducts => {
            let newProducts = [...prevProducts];
            let hasChanged = false;

            const productsFromForm = debouncedQuotationData.products.filter(p => p.name && p.name.trim() !== '');

            productsFromForm.forEach(formProduct => {
                const productData: StoredProduct = {
                    name: formProduct.name,
                    model: formProduct.model,
                    features: formProduct.features,
                    rate: formProduct.rate,
                    gstRate: formProduct.gstRate,
                };

                const existingIndex = newProducts.findIndex(p => p.name.toLowerCase() === productData.name.toLowerCase());

                if (existingIndex > -1) {
                    // It exists, check if it needs an update
                    if (JSON.stringify(newProducts[existingIndex]) !== JSON.stringify(productData)) {
                        newProducts[existingIndex] = productData;
                        hasChanged = true;
                    }
                } else {
                    // It's a new product, add it
                    newProducts.push(productData);
                    hasChanged = true;
                }
            });

            return hasChanged ? newProducts : prevProducts;
        });

    }, [debouncedQuotationData, isDataLoaded, setProducts]);


    const handleBlur = () => {
        setTimeout(() => setActiveSuggestionBox(null), 150);
    };

    const selectClientSuggestion = (client: Client) => {
        setQuotationData(prev => ({ ...prev, client }));
        setActiveSuggestionBox(null);
    };

    const selectProductSuggestion = (productId: string, suggestedProduct: StoredProduct) => {
        setQuotationData(prev => ({
            ...prev,
            products: prev.products.map(p =>
                p.id === productId
                    ? { ...p, name: suggestedProduct.name, model: suggestedProduct.model, features: suggestedProduct.features, rate: suggestedProduct.rate, gstRate: suggestedProduct.gstRate }
                    : p
            ),
        }));
        setActiveSuggestionBox(null);
    };
    
    const handleClientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setQuotationData(prev => ({ ...prev, client: { ...prev.client, [name]: value } }));

        if (name === 'name') {
            if (value) {
                const suggestions = clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
                setClientSuggestions(suggestions);
            } else {
                setClientSuggestions([]);
            }
        }
    };
    
    const handleProductChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setQuotationData(prev => ({
            ...prev,
            products: prev.products.map(p =>
                p.id === id ? { ...p, [name]: name === 'quantity' || name === 'rate' || name === 'gstRate' ? parseFloat(value) || 0 : value } : p
            ),
        }));

        if (name === 'name') {
            if (value) {
                const suggestions = products.filter(p => p.name.toLowerCase().includes(value.toLowerCase()));
                setProductSuggestions(suggestions);
            } else {
                setProductSuggestions([]);
            }
        }
    };
    
    const addProduct = () => {
        setQuotationData(prev => ({
            ...prev,
            products: [...prev.products, { id: crypto.randomUUID(), name: '', model: '', features: '', quantity: 1, rate: 0, gstRate: 12 }],
        }));
    };
    
    const removeProduct = (id: string) => {
        setQuotationData(prev => ({
            ...prev,
            products: prev.products.filter(p => p.id !== id),
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setQuotationData(prev => ({ ...prev, [name]: reader.result as string }));
            };
            reader.readAsDataURL(files[0]);
        }
    };

    const handleTermsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setQuotationData(prev => ({
            ...prev,
            terms: { ...prev.terms, [name]: value }
        }));
    };
    
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setQuotationData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const saveOrUpdateHistory = async (quote: QuotationData) => {
        try {
            const docId = await saveQuotationToFirebase(quote);
            const quoteWithId = { ...quote, id: docId };
            
            setHistory(prevHistory => {
                const existingIndex = prevHistory.findIndex(h => h.refNo === quote.refNo);
                let newHistory: QuotationData[];
                if (existingIndex > -1) {
                    newHistory = [...prevHistory];
                    newHistory[existingIndex] = quoteWithId;
                } else {
                    newHistory = [quoteWithId, ...prevHistory];
                }

                // Sort history: drafts first, then by ref number descending
                newHistory.sort((a, b) => {
                    const isADraft = a.status === 'draft';
                    const isBDraft = b.status === 'draft';

                    if (isADraft && !isBDraft) return -1;
                    if (!isADraft && isBDraft) return 1;

                    const aNum = parseInt(a.refNo.replace('SMQ ', ''), 10) || 0;
                    const bNum = parseInt(b.refNo.replace('SMQ ', ''), 10) || 0;
                    
                    return bNum - aNum;
                });
                return newHistory;
            });
        } catch (error) {
            console.error("Error saving quotation to Firebase:", error);
            alert('Failed to save quotation. Please check your internet connection and try again.');
        }
    };

    const handleSaveDraft = () => {
        saveOrUpdateHistory({ ...quotationData, status: 'draft' });
        alert('Draft saved successfully!');
    };

    const handleGeneratePdf = () => {
        const finalizedQuote = { ...quotationData, status: 'finalized' as const };
        saveOrUpdateHistory(finalizedQuote);
        generatePdf(finalizedQuote);

        const currentRefNumber = parseInt(finalizedQuote.refNo.replace('SMQ ', ''));
        if (!isNaN(currentRefNumber)) {
            const newLastRef = Math.max(lastRefNo, currentRefNumber);
            setLastRefNo(newLastRef);
            setQuotationData(prev => ({
                ...getInitialState(newLastRef),
                status: 'draft',
                logo: prev.logo,
                signature: prev.signature,
                stamp: prev.stamp,
            }));
        } else {
            const newLastRef = lastRefNo + 1;
            setLastRefNo(newLastRef);
            setQuotationData(prev => ({
                ...getInitialState(newLastRef),
                status: 'draft',
                logo: prev.logo,
                signature: prev.signature,
                stamp: prev.stamp,
            }));
        }
    };

    const handleLoadFromHistory = (quote: QuotationData) => {
        const defaultState = getInitialState(lastRefNo);

        // Calculate totalDiscountAmount for backward compatibility
        let totalDiscountAmount = quote.totalDiscountAmount || 0;
        const legacyQuote = quote as any;

        // Legacy: per-item discount
        if (!totalDiscountAmount && legacyQuote.products.some((p: any) => p.discount > 0)) {
            totalDiscountAmount = legacyQuote.products.reduce((sum: number, p: any) => sum + ((p.discount || 0) * p.quantity), 0);
        }
        // Legacy: percentage discount
        else if (!totalDiscountAmount && legacyQuote.totalDiscountPercentage > 0) {
            const grossTotal = legacyQuote.products.reduce((sum: number, p: any) => sum + (p.quantity * p.rate), 0);
            totalDiscountAmount = grossTotal * (legacyQuote.totalDiscountPercentage / 100);
        }
        
        // Generate subject if it doesn't exist for older quotes
        const subject = quote.subject === undefined
            ? (quote.products.length > 0 ? `Reg. Price Quotation for ${quote.products.map(p => p.name).join(' and ')}.` : '')
            : quote.subject;

        const mergedData: QuotationData = {
            ...defaultState,
            ...quote,
            subject,
            client: { ...defaultState.client, ...quote.client },
            terms: { ...defaultState.terms, ...quote.terms },
            bankDetails: { ...defaultState.bankDetails, ...quote.bankDetails },
            products: quote.products.map(p => ({
                id: p.id || crypto.randomUUID(),
                name: p.name || '',
                model: p.model || '',
                features: p.features || '',
                quantity: p.quantity || 1,
                rate: p.rate || 0,
                gstRate: p.gstRate || 12,
            })),
            totalDiscountAmount, // Use the calculated/existing amount
            // Preserve assets from the current session
            logo: quotationData.logo,
            signature: quotationData.signature,
            stamp: quotationData.stamp,
        };

        delete (mergedData as any).totalDiscountPercentage; // Clean up old property
        
        setQuotationData(mergedData);
        setActiveRightPanel('preview'); // Switch to preview after loading
        if (window.innerWidth < 768) {
            setActiveMobileView('form');
        }
    };
    
    const handleDeleteFromHistory = async (refNo: string) => {
        if (window.confirm(`Are you sure you want to delete quotation ${refNo}?`)) {
            try {
                await deleteQuotationFromFirebase(refNo);
                setHistory(prev => prev.filter(q => q.refNo !== refNo));
            } catch (error) {
                console.error("Error deleting quotation from Firebase:", error);
                alert('Failed to delete quotation. Please check your internet connection and try again.');
            }
        }
    };

    const handleRedownload = (quote: QuotationData) => {
        generatePdf(quote);
    }
    
    const handleUpdateProduct = (originalName: string, updatedProduct: StoredProduct) => {
        setProducts(prevProducts => {
            const productIndex = prevProducts.findIndex(p => p.name.toLowerCase() === originalName.toLowerCase());
            if (productIndex > -1) {
                const newProducts = [...prevProducts];

                const duplicateIndex = newProducts.findIndex((p, index) => 
                    index !== productIndex && p.name.toLowerCase() === updatedProduct.name.toLowerCase()
                );

                if (duplicateIndex > -1) {
                    alert(`Product name "${updatedProduct.name}" already exists. Please use a unique name.`);
                    return prevProducts; // Abort update
                }
                
                newProducts[productIndex] = updatedProduct;
                return newProducts;
            }
            return prevProducts;
        });
        alert('Product updated successfully!');
    };

    const handleDeleteProduct = (productName: string) => {
        if (window.confirm(`Are you sure you want to delete the product "${productName}"? This cannot be undone.`)) {
            setProducts(prev => prev.filter(p => p.name.toLowerCase() !== productName.toLowerCase()));
        }
    };

    const handleCopyProduct = (product: StoredProduct) => {
        setCopiedProduct(product);
        alert(`Product "${product.name}" copied. You can now paste it in the Product Details section.`);
    };

    const handlePasteProduct = () => {
        if (!copiedProduct) return;

        const lastProduct = quotationData.products[quotationData.products.length - 1];
        const isLastProductEmpty = lastProduct && !lastProduct.name.trim() && !lastProduct.model.trim() && lastProduct.rate === 0;

        const newProduct: ProductItem = {
            ...copiedProduct,
            id: crypto.randomUUID(),
            quantity: 1,
        };
        
        if (isLastProductEmpty) {
            // If the last product item is empty, replace it with the copied product
            setQuotationData(prev => ({
                ...prev,
                products: [...prev.products.slice(0, -1), { ...newProduct, id: lastProduct.id }],
            }));
        } else {
            // Otherwise, add the copied product as a new item
            setQuotationData(prev => ({
                ...prev,
                products: [...prev.products, newProduct],
            }));
        }
    };


    const renderInput = (label: string, name: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type = 'text', props = {}) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <input type={type} id={name} name={name} value={value} onChange={onChange} {...props} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm" />
        </div>
    );

    const renderTextarea = (label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, rows = 3) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"></textarea>
        </div>
    );

    return (
        <main
            className="flex flex-col md:flex-row h-screen font-sans"
            style={{
                backgroundColor: '#f0faf9',
                backgroundImage: `url(${backgroundPattern})`,
                backgroundRepeat: 'repeat',
                backgroundSize: '250px',
            }}
        >
            {/* Left Side: Form */}
            <div className={`w-full md:w-1/2 p-4 sm:p-6 overflow-y-auto ${activeMobileView === 'form' ? 'block' : 'hidden'} md:block`}>
                <div className="bg-white p-4 sm:p-6 shadow-lg rounded-lg border border-gray-200 text-gray-900">
                    <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">SREE MEDITEC Quotation Generator</h1>

                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Quotation Details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderInput('Reference No.', 'refNo', quotationData.refNo, (e) => setQuotationData(prev => ({...prev, refNo: e.target.value})))}
                            {renderInput('Date', 'date', quotationData.date, (e) => setQuotationData(prev => ({...prev, date: e.target.value})), 'date')}
                        </div>
                    </section>

                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Client Details</h2>
                        <div className="relative">
                           <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">Client Name</label>
                            <input type="text" id="clientName" name="name" value={quotationData.client.name} onChange={handleClientChange} onFocus={() => setActiveSuggestionBox('client')} onBlur={handleBlur} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm" autoComplete="off" />
                            {activeSuggestionBox === 'client' && clientSuggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                                    {clientSuggestions.map((client, i) => (
                                        <li key={i} onMouseDown={() => selectClientSuggestion(client)} className="px-3 py-2 cursor-pointer hover:bg-gray-100">{client.name}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                         {renderTextarea('Client Address', 'address', quotationData.client.address, handleClientChange)}
                         {renderInput('Client GST', 'gst', quotationData.client.gst, handleClientChange)}
                    </section>
                    
                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Subject</h2>
                        {renderInput('Subject Line', 'subject', quotationData.subject, (e) => setQuotationData(prev => ({...prev, subject: e.target.value})))}
                    </section>

                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Product Details</h2>
                        {quotationData.products.map((product, index) => (
                            <div key={product.id} className="p-4 border rounded-md space-y-3 bg-gray-50/50">
                                <div className="flex justify-between items-center">
                                    <p className="font-medium text-gray-600">Product #{index + 1}</p>
                                    {quotationData.products.length > 1 && <button onClick={() => removeProduct(product.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>}
                                </div>
                                <div className="relative">
                                    <label htmlFor={`productName-${product.id}`} className="block text-sm font-medium text-gray-700">Product Name</label>
                                    <input type="text" id={`productName-${product.id}`} name="name" value={product.name} onChange={(e) => handleProductChange(product.id, e)} onFocus={() => setActiveSuggestionBox(`product-${product.id}`)} onBlur={handleBlur} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm" autoComplete="off" />
                                     {activeSuggestionBox === `product-${product.id}` && productSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                                            {productSuggestions.map((p, i) => (
                                                <li key={i} onMouseDown={() => selectProductSuggestion(product.id, p)} className="px-3 py-2 cursor-pointer hover:bg-gray-100">{p.name}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {renderInput('Model', 'model', product.model, (e) => handleProductChange(product.id, e))}
                                  {renderInput('Quantity', 'quantity', product.quantity, (e) => handleProductChange(product.id, e), 'number')}
                                </div>
                                {renderTextarea('Features (one per line)', 'features', product.features, (e) => handleProductChange(product.id, e))}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {renderInput('Rate (List Price)', 'rate', product.rate, (e) => handleProductChange(product.id, e), 'number', {step: "0.01"})}
                                  {renderInput('GST Rate (%)', 'gstRate', product.gstRate, (e) => handleProductChange(product.id, e), 'number')}
                                </div>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 pt-2">
                            <button onClick={addProduct} className="flex-grow text-[#5aa5a0] bg-[#e6f7f6] hover:bg-[#d9f2f0] px-4 py-2 rounded-md transition-colors text-sm font-medium">Add Product</button>
                            {copiedProduct && (
                                <button onClick={handlePasteProduct} className="flex-grow text-green-600 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-md transition-colors text-sm font-medium whitespace-nowrap">
                                    Paste "{copiedProduct.name.substring(0, 15)}{copiedProduct.name.length > 15 ? '...' : ''}"
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Charges & Discounts</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {renderInput('Total Discount Amount', 'totalDiscountAmount', quotationData.totalDiscountAmount || 0, handleNumericChange, 'number', {step: "0.01"})}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                           {renderInput('Freight', 'freight', quotationData.freight, handleNumericChange, 'number', {step: "0.01"})}
                           {renderInput('Freight GST Rate (%)', 'freightGstRate', quotationData.freightGstRate, handleNumericChange, 'number')}
                        </div>
                    </section>

                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Terms & Conditions</h2>
                        {renderTextarea('Payment Terms', 'payment', quotationData.terms.payment, handleTermsChange, 4)}
                        {renderTextarea('Delivery Terms', 'delivery', quotationData.terms.delivery, handleTermsChange, 2)}
                        {renderTextarea('Warranty Terms', 'warranty', quotationData.terms.warranty, handleTermsChange, 2)}
                    </section>

                    <section className="space-y-4 mb-6">
                         <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Assets</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                            {['logo', 'signature', 'stamp'].map(asset => (
                                <div key={asset}>
                                    <label htmlFor={asset} className="block text-sm font-medium text-gray-700 capitalize">{asset}</label>
                                    <input type="file" id={asset} name={asset} onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#e6f7f6] file:text-[#5aa5a0] hover:file:bg-[#d9f2f0]"/>
                                    {quotationData[asset as keyof QuotationData] && <img src={quotationData[asset as keyof QuotationData] as string} alt={asset} className="mt-2 h-16 w-auto object-contain border p-1 rounded"/>}
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="mt-8 flex flex-col sm:flex-row-reverse justify-center gap-3">
                        <button onClick={handleGeneratePdf} className="w-full sm:w-auto bg-[#81D7D3] hover:bg-[#6abfb8] text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#81D7D3]">
                          Generate PDF & Create New
                        </button>
                        <button onClick={handleSaveDraft} className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">
                            Save Draft
                        </button>
                    </div>

                </div>
            </div>

            {/* Right Side: Preview/History */}
            <div className={`w-full md:w-1/2 p-4 sm:p-6 overflow-y-auto ${activeMobileView === 'rightPanel' ? 'block' : 'hidden'} md:block`}>
                <div className="sticky top-0 z-10 pt-2 pb-2">
                   <div className="flex border-b border-gray-200 bg-white rounded-t-lg shadow-lg">
                       <button onClick={() => setActiveRightPanel('preview')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-tl-lg ${activeRightPanel === 'preview' ? 'bg-[#81D7D3] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Preview</button>
                       <button onClick={() => setActiveRightPanel('history')} className={`flex-1 py-2 px-4 text-sm font-medium ${activeRightPanel === 'history' ? 'bg-[#81D7D3] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>History</button>
                       <button onClick={() => setActiveRightPanel('list')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-tr-lg ${activeRightPanel === 'list' ? 'bg-[#81D7D3] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>List</button>
                   </div>
               </div>
                <div>
                   {activeRightPanel === 'preview' && <QuotationPreview data={quotationData} />}
                   {activeRightPanel === 'history' && <QuotationHistory history={history} onLoad={handleLoadFromHistory} onDelete={handleDeleteFromHistory} onRedownload={handleRedownload} />}
                   {activeRightPanel === 'list' && <ProductList products={products} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onCopyProduct={handleCopyProduct} />}
                </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex shadow-2xl">
                <button onClick={() => setActiveMobileView('form')} className={`flex-1 py-3 text-sm font-medium ${activeMobileView === 'form' ? 'bg-[#81D7D3] text-white' : 'text-gray-600'}`}>Form</button>
                <button onClick={() => setActiveMobileView('rightPanel')} className={`flex-1 py-3 text-sm font-medium ${activeMobileView === 'rightPanel' ? 'bg-[#81D7D3] text-white' : 'text-gray-600'}`}>Preview/History</button>
            </div>
        </main>
    );
};

export default App;