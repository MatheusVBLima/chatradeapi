export interface Subject {
  name: string;
  averageGrade: number; // Média da nota
  absences: number;     // Número de faltas
}

export class User {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: Date;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt: Date;
  updatedAt: Date;

  // New Fields
  role: 'student' | 'coordinator';
  university?: string;
  course?: string;
  period?: number;
  subjects?: Subject[];
} 