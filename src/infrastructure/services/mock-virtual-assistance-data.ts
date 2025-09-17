import {
    OngoingActivity,
    ScheduledActivity,
    Student,
    Coordinator,
    Professional
} from "../../domain/services/virtual-assistance.service";

export const ongoingActivities: OngoingActivity[] = [
  {
    "studentName": "Alice Ferreira",
    "groupName": "Grupo 4 - Saúde Mental",
    "taskName": "Visita Domiciliar",
    "internshipLocationName": "UBS Santa Clara",
    "scheduledStartTo": "2025-07-22T08:00:00Z",
    "scheduledEndTo": "2025-07-22T12:00:00Z",
    "startedAt": "2025-07-22T08:15:00Z",
    "preceptorName": "Dr. João Mendes"
  },
  {
    "studentName": "Bruno Lima",
    "groupName": "Grupo 2 - Saúde da Família",
    "taskName": "Atendimento Ambulatorial",
    "internshipLocationName": "Clínica Escola UFPR",
    "scheduledStartTo": "2025-07-23T13:00:00Z",
    "scheduledEndTo": "2025-07-23T17:00:00Z",
    "startedAt": "2025-07-23T13:05:00Z",
    "preceptorName": "Dra. Carla Souza"
  },
  {
    "studentName": "Camila Rocha",
    "groupName": "Grupo 5 - Saúde do Idoso",
    "taskName": "Roda de Conversa",
    "internshipLocationName": "CRAS Boa Vista",
    "scheduledStartTo": "2025-07-24T09:00:00Z",
    "scheduledEndTo": "2025-07-24T11:30:00Z",
    "startedAt": "2025-07-24T09:10:00Z",
    "preceptorName": "Dr. Paulo Henrique"
  }
];

export const scheduledActivities: ScheduledActivity[] = [
  {
    "groupName": "Grupo 3 - Saúde da Criança",
    "taskName": "Consulta Pediátrica Supervisionada",
    "internshipLocationName": "UBS São José",
    "scheduledStartTo": "2025-07-25T08:00:00Z",
    "scheduledEndTo": "2025-07-25T12:00:00Z",
    "preceptorNames": ["Dra. Fernanda Costa", "Dr. Marcelo Pinheiro"]
  },
  {
    "groupName": "Grupo 1 - Saúde da Mulher",
    "taskName": "Coleta de Preventivo",
    "internshipLocationName": "Centro de Saúde Jardim das Flores",
    "scheduledStartTo": "2025-07-26T13:00:00Z",
    "scheduledEndTo": "2025-07-26T17:00:00Z",
    "preceptorNames": ["Dra. Larissa Melo"]
  },
  {
    "groupName": "Grupo 2 - Saúde da Família",
    "taskName": "Atendimento Individual com Educador",
    "internshipLocationName": "UBS Esperança",
    "scheduledStartTo": "2025-07-27T09:30:00Z",
    "scheduledEndTo": "2025-07-27T11:30:00Z",
    "preceptorNames": ["Dr. Ricardo Silva", "Dra. Ana Paula Teixeira"]
  }
];

export const studentProfessionals: Professional[] = [
  {
    "cpf": "98765432100",
    "name": "Dr. João Carlos Oliveira",
    "email": "joao.oliveira@preceptores.ufpr.br",
    "phone": "41999887766",
    "groupNames": ["Grupo 1 - Saúde da Mulher", "Grupo 4 - Saúde Mental"]
  },
  {
    "cpf": "87654321099",
    "name": "Dra. Maria Eduarda Silva",
    "email": "maria.silva@preceptores.ufpr.br",
    "phone": "41988776655",
    "groupNames": ["Grupo 2 - Saúde da Família"]
  },
  {
    "cpf": "11122233344",
    "name": "Dr. Ricardo Silva",
    "email": "ricardo.silva@preceptores.ufpr.br",
    "phone": "41987654321",
    "groupNames": ["Grupo 2 - Saúde da Família"]
  },
  {
    "cpf": "22233344455",
    "name": "Dra. Ana Paula Teixeira",
    "email": "ana.teixeira@preceptores.ufpr.br",
    "phone": "41987654322",
    "groupNames": ["Grupo 2 - Saúde da Família"]
  },
  {
    "cpf": "33344455566",
    "name": "Dra. Carla Souza",
    "email": "carla.souza@preceptores.ufpr.br",
    "phone": "41987654323",
    "groupNames": ["Grupo 2 - Saúde da Família"]
  },
  {
    "cpf": "76543210988",
    "name": "Dr. Rafael Costa Lima",
    "email": "rafael.lima@preceptores.ufpr.br",
    "phone": null,
    "groupNames": ["Grupo 3 - Saúde da Criança", "Grupo 5 - Saúde do Idoso"]
  },
  {
    "cpf": "44455566677",
    "name": "Dra. Fernanda Costa",
    "email": "fernanda.costa@preceptores.ufpr.br",
    "phone": "41987654324",
    "groupNames": ["Grupo 3 - Saúde da Criança"]
  },
  {
    "cpf": "55566677788",
    "name": "Dr. Marcelo Pinheiro",
    "email": "marcelo.pinheiro@preceptores.ufpr.br",
    "phone": "41987654325",
    "groupNames": ["Grupo 3 - Saúde da Criança"]
  },
  {
    "cpf": "66677788899",
    "name": "Dra. Larissa Melo",
    "email": "larissa.melo@preceptores.ufpr.br",
    "phone": "41987654326",
    "groupNames": ["Grupo 1 - Saúde da Mulher"]
  },
  {
    "cpf": "77788899000",
    "name": "Dr. João Mendes",
    "email": "joao.mendes@preceptores.ufpr.br",
    "phone": "41987654327",
    "groupNames": ["Grupo 4 - Saúde Mental"]
  },
  {
    "cpf": "88899000111",
    "name": "Dr. Paulo Henrique",
    "email": "paulo.henrique@preceptores.ufpr.br",
    "phone": "41987654328",
    "groupNames": ["Grupo 5 - Saúde do Idoso"]
  }
];

export const coordinatorProfessionals: Professional[] = [
  {
    "cpf": "11223344556",
    "name": "Dr. Gustavo Andrade",
    "email": "gustavo.andrade@preceptores.ufpr.br",
    "phone": "41999887766",
    "groupNames": ["Grupo 1 - Saúde da Mulher", "Grupo 3 - Saúde da Criança"],
    "pendingValidationWorkloadMinutes": 120
  },
  {
    "cpf": "22334455667",
    "name": "Dra. Helena Ribeiro",
    "email": "helena.ribeiro@preceptores.ufpr.br",
    "phone": null,
    "groupNames": ["Grupo 2 - Saúde Mental"],
    "pendingValidationWorkloadMinutes": 45
  },
  {
    "cpf": "33445566778",
    "name": "Dr. Eduardo Martins",
    "email": "eduardo.martins@preceptores.ufpr.br",
    "phone": "41988776655",
    "groupNames": ["Grupo 5 - Saúde do Idoso"],
    "pendingValidationWorkloadMinutes": 0
  }
];

export const coordinatorStudents: Student[] = [
  {
    "cpf": "55443322100",
    "name": "Alice Ferreira",
    "email": "alice.ferreira@alunos.ufpr.br",
    "phone": "41991234567",
    "groupNames": ["Grupo 1 - Saúde da Mulher", "Grupo 4 - Saúde Mental"]
  },
  {
    "cpf": "44332211099",
    "name": "Bruno Lima",
    "email": "bruno.lima@alunos.ufpr.br",
    "phone": null,
    "groupNames": ["Grupo 2 - Saúde da Família"]
  },
  {
    "cpf": "33221100988",
    "name": "Camila Rocha",
    "email": "camila.rocha@alunos.ufpr.br",
    "phone": "41992345678",
    "groupNames": ["Grupo 3 - Saúde da Criança", "Grupo 5 - Saúde do Idoso"]
  }
];

export const coordinatorDetails: Coordinator = {
  "cpf": "111.111.111-11", // Assigned CPF for login
  "coordinatorName": "Prof. Daniela Moura",
  "coordinatorEmail": "daniela.moura@ufpr.br",
  "coordinatorPhone": "41991112233",
  "groupNames": [
    "Grupo 1 - Saúde da Mulher",
    "Grupo 2 - Saúde da Família",
    "Grupo 4 - Saúde Mental"
  ],
  "organizationsAndCourses": [
    {
      "organizationName": "Universidade Federal do Paraná",
      "courseNames": ["Medicina", "Enfermagem"]
    },
    {
      "organizationName": "Faculdade Pequeno Príncipe",
      "courseNames": ["Medicina"]
    }
  ]
};

// --- Single Source of Truth for All People in the System ---
// We create a simplified list for user lookup, as the coordinator has a different structure
export const allMockUsers = [
    ...studentProfessionals,
    ...coordinatorProfessionals,
    ...coordinatorStudents,
    { 
      cpf: coordinatorDetails.cpf, 
      name: coordinatorDetails.coordinatorName,
      email: coordinatorDetails.coordinatorEmail,
      phone: coordinatorDetails.coordinatorPhone
    }
]; 