
import React, { useState, useMemo } from 'react';
import { StoredProduct } from '../types';

interface ProductListProps {
  products: StoredProduct[];
  onUpdateProduct: (originalName: string, updatedProduct: StoredProduct) => void;
  onDeleteProduct: (productName: string) => void;
  onCopyProduct: (product: StoredProduct) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const ProductList: React.FC<ProductListProps> = ({ products, onUpdateProduct, onDeleteProduct, onCopyProduct }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [editingProductOriginalName, setEditingProductOriginalName] = useState<string | null>(null);
  const [formData, setFormData] = useState<StoredProduct | null>(null);


  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(lowercasedFilter) ||
      product.model.toLowerCase().includes(lowercasedFilter)
    );
  }, [products, searchTerm]);
  
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProducts]);

  const handleCopy = (product: StoredProduct) => {
    onCopyProduct(product);
    setCopiedName(product.name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleEditClick = (product: StoredProduct) => {
    setEditingProductOriginalName(product.name);
    setFormData({ ...product });
  };

  const handleCancel = () => {
    setEditingProductOriginalName(null);
    setFormData(null);
  };

  const handleSave = () => {
    if (!formData || !editingProductOriginalName) return;
    
    if (!formData.name.trim() || !formData.model.trim()) {
        alert('Product Name and Model cannot be empty.');
        return;
    }
    
    onUpdateProduct(editingProductOriginalName, formData);
    handleCancel();
  };


  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData) {
      const { name, value } = e.target;
      const isNumeric = name === 'rate' || name === 'gstRate';
      setFormData({
        ...formData,
        [name]: isNumeric ? parseFloat(value) || 0 : value,
      });
    }
  };

  const toggleFeatures = (productName: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productName)) {
        newSet.delete(productName);
      } else {
        newSet.add(productName);
      }
      return newSet;
    });
  };
  
  const renderForm = () => {
    if (!formData) return null;
    return (
        <div className={`p-4 border rounded-lg transition-all duration-300 bg-[#e6f7f6] shadow-md mb-4`}>
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Edit Product</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Product Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleFieldChange} className="block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"/>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Model</label>
                        <input type="text" name="model" value={formData.model} onChange={handleFieldChange} className="block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Rate</label>
                        <input type="number" name="rate" value={formData.rate} onChange={handleFieldChange} className="block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm" step="0.01"/>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">GST Rate (%)</label>
                        <input type="number" name="gstRate" value={formData.gstRate} onChange={handleFieldChange} className="block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"/>
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Features (one per line)</label>
                    <textarea name="features" value={formData.features} onChange={handleFieldChange} rows={4} className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"/>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                    <button onClick={handleSave} className="text-xs font-medium text-white bg-[#81D7D3] hover:bg-[#6abfb8] px-3 py-1.5 rounded-md transition-colors">Save Changes</button>
                    <button onClick={handleCancel} className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors">Cancel</button>
                </div>
            </div>
        </div>
    );
  };


  return (
    <div className="bg-white p-4 sm:p-6 shadow-lg rounded-b-lg border border-t-0 border-gray-200 text-gray-900 max-h-[85vh] overflow-y-auto">
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by Product Name or Model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#81D7D3] focus:border-[#81D7D3] sm:text-sm"
          />
        </div>
      </div>
      
      {editingProductOriginalName && renderForm()}

      {products.length === 0 ? (
        <div className="text-center py-10">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Products Saved</h3>
          <p className="mt-1 text-sm text-gray-500">Products you use in quotations will be saved and listed here.</p>
        </div>
      ) : sortedProducts.length === 0 ? (
         <div className="text-center py-10">
           <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Results Found</h3>
          <p className="mt-1 text-sm text-gray-500">Your search for "{searchTerm}" did not match any products.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedProducts.map((product) => {
            const isEditingThisProduct = editingProductOriginalName === product.name;
            if (isEditingThisProduct) return null; // Don't show the card if its form is open elsewhere

            const isExpanded = expandedRows.has(product.name);
            return (
                <div key={product.name} className="p-4 border rounded-lg bg-white shadow-sm">
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                        <div className="flex-grow">
                            <p className="text-base font-semibold text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-600">{product.model}</p>
                            <div className="flex items-center gap-x-6 gap-y-2 mt-2 text-sm flex-wrap">
                                <div>
                                <span className="text-gray-500">Rate: </span>
                                <span className="font-medium text-gray-800">Rs.{formatCurrency(product.rate)}</span>
                                </div>
                                <div>
                                <span className="text-gray-500">GST: </span>
                                <span className="font-medium text-gray-800">{product.gstRate}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center justify-end space-x-2 w-full sm:w-auto">
                            <button onClick={() => handleEditClick(product)} className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors">Edit</button>
                            <button onClick={() => handleCopy(product)} className="text-xs font-medium text-[#5aa5a0] bg-[#e6f7f6] hover:bg-[#d9f2f0] px-3 py-1.5 rounded-md transition-colors">{copiedName === product.name ? 'Copied!' : 'Copy'}</button>
                            <button onClick={() => onDeleteProduct(product.name)} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">Delete</button>
                        </div>
                      </div>
                      <div className="mt-3">
                         <button onClick={() => toggleFeatures(product.name)} className="text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1">
                            <span>{isExpanded ? 'Hide Features' : 'Show Features'}</span>
                             <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                             </svg>
                         </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t text-sm text-gray-800">
                            <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600 whitespace-pre-wrap">
                                {product.features.split('\n').map((f, i) => f.trim() && <li key={i}>{f}</li>)}
                            </ul>
                        </div>
                      )}
                    </>
                </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default ProductList;
