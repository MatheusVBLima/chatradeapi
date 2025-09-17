export interface OngoingActivity {
    studentName: string;
    groupName: string;
    taskName: string;
    internshipLocationName: string;
    scheduledStartTo: string;
    scheduledEndTo: string;
    startedAt: string;
    preceptorName: string;
}

export interface ScheduledActivity {
    groupName: string;
    taskName: string;
    internshipLocationName: string;
    scheduledStartTo: string;
    scheduledEndTo: string;
    preceptorNames: string[];
}

export interface Professional {
    cpf: string;
    name: string;
    email: string;
    phone: string | null;
    groupNames: string[];
    pendingValidationWorkloadMinutes?: number;
}

export interface Student {
    cpf: string;
    name: string;
    email: string;
    phone: string | null;
    groupNames: string[];
}

export interface Coordinator {
    cpf: string;
    coordinatorName: string;
    coordinatorEmail: string;
    coordinatorPhone: string;
    groupNames: string[];
    organizationsAndCourses: {
        organizationName: string;
        courseNames: string[];
    }[];
}

export interface StudentInfo {
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    groupNames: string[];
    organizationsAndCourses: {
        organizationName: string;
        courseNames: string[];
    }[];
}

export interface CoordinatorInfo {
    coordinatorName: string;
    coordinatorEmail: string;
    coordinatorPhone: string;
    groupNames: string[];
    organizationsAndCourses: {
        organizationName: string;
        courseNames: string[];
    }[];
}


export const VIRTUAL_ASSISTANCE_SERVICE = 'VirtualAssistanceService';

export interface VirtualAssistanceService {
    getCoordinatorsOngoingActivities(cpf: string): Promise<OngoingActivity[]>;
    getCoordinatorsProfessionals(cpf: string): Promise<Professional[]>;
    getCoordinatorsStudents(cpf: string): Promise<Student[]>;
    getCoordinatorDetails(cpf: string): Promise<Coordinator | null>;
    getStudentsScheduledActivities(cpf: string): Promise<ScheduledActivity[]>;
    getStudentsProfessionals(cpf: string): Promise<Professional[]>;
    getStudentInfo(cpf: string): Promise<StudentInfo>;
    getCoordinatorInfo(cpf: string): Promise<CoordinatorInfo>;
} 