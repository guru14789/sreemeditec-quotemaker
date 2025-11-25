import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { QuotationData } from '../types';

const QUOTATIONS_COLLECTION = 'quotations';

export interface FirebaseQuotation extends QuotationData {
  id?: string;
  createdAt?: Timestamp;
}

export const saveQuotationToFirebase = async (quotation: QuotationData): Promise<string> => {
  try {
    const quotationData: FirebaseQuotation = {
      ...quotation,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), quotationData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving quotation to Firebase:', error);
    throw error;
  }
};

export const loadQuotationsFromFirebase = async (maxResults: number = 50): Promise<FirebaseQuotation[]> => {
  try {
    const q = query(
      collection(db, QUOTATIONS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    const quotations: FirebaseQuotation[] = [];
    
    querySnapshot.forEach((doc) => {
      quotations.push({
        id: doc.id,
        ...doc.data()
      } as FirebaseQuotation);
    });
    
    return quotations;
  } catch (error) {
    console.error('Error loading quotations from Firebase:', error);
    throw error;
  }
};

export const deleteQuotationFromFirebase = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, QUOTATIONS_COLLECTION, id));
  } catch (error) {
    console.error('Error deleting quotation from Firebase:', error);
    throw error;
  }
};
