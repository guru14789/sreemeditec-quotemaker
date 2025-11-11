
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QuotationData, Client, StoredProduct, ProductItem } from './types';
import { DEFAULT_TERMS, DEFAULT_BANK_DETAILS } from './constants';
import QuotationPreview from './components/QuotationPreview';
import QuotationHistory from './components/QuotationHistory';
import { generatePdf } from './services/pdfGenerator';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useDebounce } from './hooks/useDebounce';

const formatRefNo = (num: number) => `SMQ ${String(num).padStart(3, '0')}`;

const App: React.FC = () => {
    const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
    const [products, setProducts] = useLocalStorage<StoredProduct[]>('products', []);
    const [lastRefNo, setLastRefNo] = useLocalStorage<number>('lastRefNo', 71);
    const [history, setHistory] = useLocalStorage<QuotationData[]>('quotationHistory', []);
    
    const [activeMobileView, setActiveMobileView] = useState<'form' | 'rightPanel'>('form');
    const [activeRightPanel, setActiveRightPanel] = useState<'preview' | 'history'>('preview');

    const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
    const [productSuggestions, setProductSuggestions] = useState<StoredProduct[]>([]);
    const [activeSuggestionBox, setActiveSuggestionBox] = useState<string | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
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


    const getInitialState = useCallback((currentLastRef: number): Omit<QuotationData, 'logo' | 'signature' | 'stamp' | 'status'> => ({
        refNo: formatRefNo(currentLastRef + 1),
        date: new Date().toISOString().split('T')[0],
        client: { name: '', address: '', gst: '' },
        products: [{ id: crypto.randomUUID(), name: '', model: '', features: '', quantity: 1, rate: 0, gstRate: 12 }],
        terms: DEFAULT_TERMS,
        bankDetails: DEFAULT_BANK_DETAILS,
        freight: 0,
        freightGstRate: 18,
    }), []);

    const [quotationData, setQuotationData] = useState<QuotationData>(() => ({
        ...getInitialState(lastRefNo),
        logo: null,
        signature: null,
        stamp: null,
        status: 'draft',
    }));
    
    const debouncedQuotationData = useDebounce(quotationData, 500);

    // Effect for AUTOSAVING to localStorage
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

        // Save/Update products from form
        setProducts(prevProducts => {
            const newProducts = [...prevProducts];
            let hasChanged = false;
            debouncedQuotationData.products.forEach((p: ProductItem) => {
                if (!p.name) return;
                const { id, quantity, ...productToStore } = p;
                const productIndex = newProducts.findIndex(sp => sp.name.toLowerCase() === p.name.toLowerCase());

                if (productIndex > -1) {
                    if (JSON.stringify(newProducts[productIndex]) !== JSON.stringify(productToStore)) {
                        newProducts[productIndex] = productToStore;
                        hasChanged = true;
                    }
                } else {
                    newProducts.push(productToStore);
                    hasChanged = true;
                }
            });
            return hasChanged ? newProducts : prevProducts;
        });
        
        prevQuotationDataRef.current = debouncedQuotationData;

    }, [debouncedQuotationData, isDataLoaded, setClients, setProducts]);

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
    
    const handleFreightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setQuotationData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const saveOrUpdateHistory = (quote: QuotationData) => {
        setHistory(prevHistory => {
            const existingIndex = prevHistory.findIndex(h => h.refNo === quote.refNo);
            let newHistory: QuotationData[];
            if (existingIndex > -1) {
                newHistory = [...prevHistory];
                newHistory[existingIndex] = quote;
            } else {
                newHistory = [quote, ...prevHistory];
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
        // Deep merge to prevent missing fields if loading an older quote structure
        const mergedData: QuotationData = {
            ...defaultState,
            ...quote,
            client: { ...defaultState.client, ...quote.client },
            terms: { ...defaultState.terms, ...quote.terms },
            bankDetails: { ...defaultState.bankDetails, ...quote.bankDetails },
            products: quote.products.map(p => ({
                id: p.id || crypto.randomUUID(), // Ensure old products get an ID
                name: p.name || '',
                model: p.model || '',
                features: p.features || '',
                quantity: p.quantity || 1,
                rate: p.rate || 0,
                gstRate: p.gstRate || 12,
            })),
            // Preserve assets from the current session
            logo: quotationData.logo,
            signature: quotationData.signature,
            stamp: quotationData.stamp,
        };
        setQuotationData(mergedData);
        setActiveRightPanel('preview'); // Switch to preview after loading
        if (window.innerWidth < 768) {
            setActiveMobileView('form');
        }
    };
    
    const handleDeleteFromHistory = (refNo: string) => {
        if (window.confirm(`Are you sure you want to delete quotation ${refNo}?`)) {
            setHistory(prev => prev.filter(q => q.refNo !== refNo));
        }
    };

    const handleRedownload = (quote: QuotationData) => {
        generatePdf(quote);
    }
    
    const renderInput = (label: string, name: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type = 'text', props = {}) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <input type={type} id={name} name={name} value={value} onChange={onChange} {...props} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
    );

    const renderTextarea = (label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, rows = 3) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
        </div>
    );

    return (
        <main className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">
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
                            <input type="text" id="clientName" name="name" value={quotationData.client.name} onChange={handleClientChange} onFocus={() => setActiveSuggestionBox('client')} onBlur={handleBlur} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" autoComplete="off" />
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
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Product Details</h2>
                        {quotationData.products.map((product, index) => (
                            <div key={product.id} className="p-4 border rounded-md space-y-3 bg-gray-50/50">
                                <div className="flex justify-between items-center">
                                    <p className="font-medium text-gray-600">Product #{index + 1}</p>
                                    {quotationData.products.length > 1 && <button onClick={() => removeProduct(product.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>}
                                </div>
                                <div className="relative">
                                    <label htmlFor={`productName-${product.id}`} className="block text-sm font-medium text-gray-700">Product Name</label>
                                    <input type="text" id={`productName-${product.id}`} name="name" value={product.name} onChange={(e) => handleProductChange(product.id, e)} onFocus={() => setActiveSuggestionBox(`product-${product.id}`)} onBlur={handleBlur} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" autoComplete="off" />
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
                                  {renderInput('Rate', 'rate', product.rate, (e) => handleProductChange(product.id, e), 'number', {step: "0.01"})}
                                  {renderInput('GST Rate (%)', 'gstRate', product.gstRate, (e) => handleProductChange(product.id, e), 'number')}
                                </div>
                            </div>
                        ))}
                        <button onClick={addProduct} className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-md transition-colors text-sm font-medium">Add Product</button>
                    </section>
                    
                    <section className="space-y-4 mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Freight Charges</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {renderInput('Freight', 'freight', quotationData.freight, handleFreightChange, 'number', {step: "0.01"})}
                           {renderInput('Freight GST Rate (%)', 'freightGstRate', quotationData.freightGstRate, handleFreightChange, 'number')}
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
                                    <input type="file" id={asset} name={asset} onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                                    {quotationData[asset as keyof QuotationData] && <img src={quotationData[asset as keyof QuotationData] as string} alt={asset} className="mt-2 h-16 w-auto object-contain border p-1 rounded"/>}
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="mt-8 flex flex-col sm:flex-row-reverse justify-center gap-3">
                        <button onClick={handleGeneratePdf} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
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
                <div className="sticky top-0 bg-gray-100 z-10 pt-2 pb-2">
                   <div className="flex border-b border-gray-200 bg-white rounded-t-lg shadow-lg">
                       <button onClick={() => setActiveRightPanel('preview')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-tl-lg ${activeRightPanel === 'preview' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Preview</button>
                       <button onClick={() => setActiveRightPanel('history')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-tr-lg ${activeRightPanel === 'history' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>History</button>
                   </div>
               </div>
                <div>
                   {activeRightPanel === 'preview' && <QuotationPreview data={quotationData} />}
                   {activeRightPanel === 'history' && <QuotationHistory history={history} onLoad={handleLoadFromHistory} onDelete={handleDeleteFromHistory} onRedownload={handleRedownload} />}
                </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex shadow-2xl">
                <button onClick={() => setActiveMobileView('form')} className={`flex-1 py-3 text-sm font-medium ${activeMobileView === 'form' ? 'bg-indigo-500 text-white' : 'text-gray-600'}`}>Form</button>
                <button onClick={() => setActiveMobileView('rightPanel')} className={`flex-1 py-3 text-sm font-medium ${activeMobileView === 'rightPanel' ? 'bg-indigo-500 text-white' : 'text-gray-600'}`}>Preview/History</button>
            </div>
        </main>
    );
};

export default App;