import React, { useState, useMemo } from 'react';
import { QuotationData } from '../types';

interface QuotationHistoryProps {
  history: QuotationData[];
  onLoad: (quote: QuotationData) => void;
  onDelete: (refNo: string) => void;
  onRedownload: (quote: QuotationData) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const calculateGrandTotal = (quote: QuotationData): number => {
    const subTotal = quote.products.reduce((sum, product) => {
        const baseAmount = product.quantity * product.rate;
        const totalAmount = baseAmount + (baseAmount * (product.gstRate / 100));
        return sum + totalAmount;
    }, 0);
    const freightGstAmount = quote.freight > 0 ? quote.freight * (quote.freightGstRate / 100) : 0;
    return subTotal + quote.freight + freightGstAmount;
};

const QuotationHistory: React.FC<QuotationHistoryProps> = ({ history, onLoad, onDelete, onRedownload }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm) {
      return history;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return history.filter(quote => {
      const formattedDate = new Date(quote.date).toLocaleDateString('en-GB'); // dd/mm/yyyy
      return (
        quote.refNo.toLowerCase().includes(lowercasedFilter) ||
        quote.client.name.toLowerCase().includes(lowercasedFilter) ||
        formattedDate.includes(lowercasedFilter)
      );
    });
  }, [history, searchTerm]);

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
            placeholder="Search by Ref No, Client, or Date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-10">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No History</h3>
          <p className="mt-1 text-sm text-gray-500">Generate a quotation to see it here.</p>
        </div>
      ) : filteredHistory.length === 0 ? (
         <div className="text-center py-10">
           <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Results Found</h3>
          <p className="mt-1 text-sm text-gray-500">Your search for "{searchTerm}" did not match any quotations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((quote) => (
            <div key={quote.refNo} className="border border-gray-200 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-gray-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-800">{quote.refNo}</p>
                    {quote.status === 'draft' && (
                        <span className="text-xs font-semibold inline-block py-0.5 px-2 uppercase rounded-full text-yellow-700 bg-yellow-200">
                            Draft
                        </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{quote.client.name}</p>
                  <p className="text-xs text-gray-500">{new Date(quote.date).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-lg text-gray-900">Rs. {formatCurrency(calculateGrandTotal(quote))}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-end space-x-2">
                <button
                  onClick={() => onLoad(quote)}
                  className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md transition-colors"
                  aria-label={`Load quotation ${quote.refNo} into form`}
                >
                  Load
                </button>
                <button
                  onClick={() => onRedownload(quote)}
                  disabled={quote.status === 'draft'}
                  className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   aria-label={`Re-download PDF for quotation ${quote.refNo}`}
                >
                  Re-download
                </button>
                 <button
                  onClick={() => onDelete(quote.refNo)}
                  className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                  aria-label={`Delete quotation ${quote.refNo}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuotationHistory;