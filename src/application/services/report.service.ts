import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as Papa from 'papaparse';

@Injectable()
export class ReportService {

  private formatDataForDisplay(data: any, reportTitle: string = 'Dados'): string {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return 'Não há dados para gerar o relatório.';
    }

    const dataArray = Array.isArray(data) ? data : [data];
    let formatted = `RELATÓRIO: ${reportTitle.toUpperCase()}\n`;
    formatted += '='.repeat(50) + '\n\n';

    return this.formatDataContent(dataArray, formatted);
  }

  private formatDataForDisplayPDF(data: any, reportTitle: string = 'Dados'): string {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return 'Não há dados para gerar o relatório.';
    }

    const dataArray = Array.isArray(data) ? data : [data];
    let formatted = ''; // Sem título para PDF pois já está no cabeçalho

    return this.formatDataContent(dataArray, formatted, true); // true = modo PDF
  }

  private formatDataContent(dataArray: any[], formatted: string, isPdf: boolean = false): string {
    // Define indentação: sem espaços para PDF, com espaços para TXT/CSV
    const indent = isPdf ? '' : '   ';

    dataArray.forEach((item, index) => {
      // Não adiciona numeração no PDF
      if (!isPdf) {
        formatted += `${index + 1}. `;
      }

      // Atividades em andamento
      if (item.studentName && item.taskName) {
        const startTime = new Date(item.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(item.scheduledEndTo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const date = new Date(item.scheduledStartTo).toLocaleDateString('pt-BR');

        formatted += `${item.studentName}\n`;
        formatted += `${indent}Grupo: ${item.groupName}\n`;
        formatted += `${indent}Atividade: ${item.taskName}\n`;
        formatted += `${indent}Local: ${item.internshipLocationName}\n`;
        formatted += `${indent}Data: ${date}\n`;
        formatted += `${indent}Horário: ${startTime} - ${endTime}\n`;
        formatted += `${indent}Preceptor: ${item.preceptorName}\n`;
      }
      // Atividades agendadas
      else if (item.taskName && item.preceptorNames) {
        const startTime = new Date(item.scheduledStartTo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(item.scheduledEndTo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const date = new Date(item.scheduledStartTo).toLocaleDateString('pt-BR');

        formatted += `Atividade Agendada\n`;
        formatted += `${indent}Grupo: ${item.groupName}\n`;
        formatted += `${indent}Atividade: ${item.taskName}\n`;
        formatted += `${indent}Local: ${item.internshipLocationName}\n`;
        formatted += `${indent}Data: ${date}\n`;
        formatted += `${indent}Horário: ${startTime} - ${endTime}\n`;
        formatted += `${indent}Preceptores: ${item.preceptorNames.join(', ')}\n`;
      }
      // Profissionais
      else if (item.name && item.email) {
        formatted += `${item.name}\n`;
        formatted += `${indent}CPF: ${item.cpf}\n`;
        formatted += `${indent}Email: ${item.email}\n`;
        if (item.phone) formatted += `${indent}Telefone: ${item.phone}\n`;
        if (item.groupNames) formatted += `${indent}Grupos: ${item.groupNames.join(', ')}\n`;
        if (item.pendingValidationWorkloadMinutes !== undefined) {
          formatted += `${indent}Horas pendentes: ${item.pendingValidationWorkloadMinutes} min\n`;
        }
      }
      // Estudantes (com groupNames)
      else if (item.name && item.groupNames) {
        formatted += `${item.name}\n`;
        formatted += `${indent}CPF: ${item.cpf}\n`;
        formatted += `${indent}Email: ${item.email}\n`;
        if (item.phone) formatted += `${indent}Telefone: ${item.phone}\n`;
        formatted += `${indent}Grupos: ${item.groupNames.join(', ')}\n`;
      }
      // Dados de estudante individual (formato API staging)
      else if (item.studentName || item.studentEmail) {
        formatted += `${item.studentName || 'Estudante'}\n`;
        if (item.studentEmail) formatted += `${indent}Email: ${item.studentEmail}\n`;
        if (item.studentPhone) formatted += `${indent}Telefone: ${item.studentPhone}\n`;
        if (item.groupNames) formatted += `${indent}Grupos: ${Array.isArray(item.groupNames) ? item.groupNames.join(', ') : item.groupNames}\n`;
        if (item.organizationsAndCourses) {
          const orgs = Array.isArray(item.organizationsAndCourses) ? item.organizationsAndCourses : [item.organizationsAndCourses];
          orgs.forEach(org => {
            if (org.organizationName) formatted += `${indent}Instituição: ${org.organizationName}\n`;
            if (org.courseNames) formatted += `${indent}Cursos: ${Array.isArray(org.courseNames) ? org.courseNames.join(', ') : org.courseNames}\n`;
          });
        }
      }
      // Dados de coordenador individual
      else if (item.coordinatorName || item.coordinatorEmail) {
        formatted += `${item.coordinatorName || 'Coordenador'}\n`;
        if (item.coordinatorEmail) formatted += `${indent}Email: ${item.coordinatorEmail}\n`;
        if (item.coordinatorPhone) formatted += `${indent}Telefone: ${item.coordinatorPhone}\n`;
        if (item.groupNames) formatted += `${indent}Grupos: ${Array.isArray(item.groupNames) ? item.groupNames.join(', ') : item.groupNames}\n`;
        if (item.organizationsAndCourses) {
          const orgs = Array.isArray(item.organizationsAndCourses) ? item.organizationsAndCourses : [item.organizationsAndCourses];
          orgs.forEach(org => {
            if (org.organizationName) formatted += `${indent}Instituição: ${org.organizationName}\n`;
            if (org.courseNames) formatted += `${indent}Cursos: ${Array.isArray(org.courseNames) ? org.courseNames.join(', ') : org.courseNames}\n`;
          });
        }
      }
      // Dados genéricos (fallback)
      else {
        formatted += `Registro ${index + 1}\n`;
        Object.entries(item).forEach(([key, value]) => {
          // Melhorar a apresentação das chaves
          let friendlyKey = key;
          switch(key) {
            case 'studentName': friendlyKey = 'Nome'; break;
            case 'studentEmail': friendlyKey = 'Email'; break;
            case 'studentPhone': friendlyKey = 'Telefone'; break;
            case 'coordinatorName': friendlyKey = 'Nome'; break;
            case 'coordinatorEmail': friendlyKey = 'Email'; break;
            case 'coordinatorPhone': friendlyKey = 'Telefone'; break;
            case 'groupNames': friendlyKey = 'Grupos'; break;
            case 'organizationsAndCourses': friendlyKey = 'Instituições e Cursos'; break;
            default: friendlyKey = key;
          }

          if (typeof value === 'object' && value !== null) {
            formatted += `${indent}${friendlyKey}: ${JSON.stringify(value)}\n`;
          } else {
            formatted += `${indent}${friendlyKey}: ${value}\n`;
          }
        });
      }
      
      formatted += '\n';
    });

    // Não adiciona rodapé no PDF
    if (!isPdf) {
      formatted += '='.repeat(50) + '\n';
      formatted += `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
      formatted += `Total de registros: ${dataArray.length}\n`;
    }

    return formatted;
  }

  public generateTxtReport(data: any, reportTitle: string = 'Dados'): string {
    return this.formatDataForDisplay(data, reportTitle);
  }

  public generateCsvReport(data: any, reportTitle: string = 'Dados'): string {
    if (!data) {
      return Papa.unparse([{ "Erro": "Não há dados para gerar o relatório." }]);
    }
    const dataArray = Array.isArray(data) ? data : [data];
    if (dataArray.length === 0) {
      return Papa.unparse([{ "Erro": "Não há dados para gerar o relatório." }]);
    }

    // Preparar dados para CSV com cabeçalhos em português
    const csvData = dataArray.map(item => {
      const csvItem: any = {};
      
      if (item.studentName && item.taskName) {
        // Atividades em andamento
        csvItem['Estudante'] = item.studentName;
        csvItem['Grupo'] = item.groupName;
        csvItem['Atividade'] = item.taskName;
        csvItem['Local'] = item.internshipLocationName;
        csvItem['Data_Inicio'] = new Date(item.scheduledStartTo).toLocaleDateString('pt-BR');
        csvItem['Hora_Inicio'] = new Date(item.startedAt).toLocaleTimeString('pt-BR');
        csvItem['Hora_Fim'] = new Date(item.scheduledEndTo).toLocaleTimeString('pt-BR');
        csvItem['Preceptor'] = item.preceptorName;
      } else if (item.taskName && item.preceptorNames) {
        // Atividades agendadas
        csvItem['Grupo'] = item.groupName;
        csvItem['Atividade'] = item.taskName;
        csvItem['Local'] = item.internshipLocationName;
        csvItem['Data'] = new Date(item.scheduledStartTo).toLocaleDateString('pt-BR');
        csvItem['Hora_Inicio'] = new Date(item.scheduledStartTo).toLocaleTimeString('pt-BR');
        csvItem['Hora_Fim'] = new Date(item.scheduledEndTo).toLocaleTimeString('pt-BR');
        csvItem['Preceptores'] = item.preceptorNames.join(', ');
      } else if (item.studentName || item.studentEmail) {
        // Dados de estudante individual
        csvItem['Nome'] = item.studentName;
        csvItem['Email'] = item.studentEmail;
        csvItem['Telefone'] = item.studentPhone;
        if (item.groupNames) csvItem['Grupos'] = Array.isArray(item.groupNames) ? item.groupNames.join(', ') : item.groupNames;
        if (item.organizationsAndCourses) {
          const orgs = Array.isArray(item.organizationsAndCourses) ? item.organizationsAndCourses : [item.organizationsAndCourses];
          csvItem['Instituições'] = orgs.map(org => org.organizationName).filter(Boolean).join(', ');
          csvItem['Cursos'] = orgs.map(org => Array.isArray(org.courseNames) ? org.courseNames.join(', ') : org.courseNames).filter(Boolean).join(', ');
        }
      } else if (item.coordinatorName || item.coordinatorEmail) {
        // Dados de coordenador individual
        csvItem['Nome'] = item.coordinatorName;
        csvItem['Email'] = item.coordinatorEmail;
        csvItem['Telefone'] = item.coordinatorPhone;
        if (item.groupNames) csvItem['Grupos'] = Array.isArray(item.groupNames) ? item.groupNames.join(', ') : item.groupNames;
        if (item.organizationsAndCourses) {
          const orgs = Array.isArray(item.organizationsAndCourses) ? item.organizationsAndCourses : [item.organizationsAndCourses];
          csvItem['Instituições'] = orgs.map(org => org.organizationName).filter(Boolean).join(', ');
          csvItem['Cursos'] = orgs.map(org => Array.isArray(org.courseNames) ? org.courseNames.join(', ') : org.courseNames).filter(Boolean).join(', ');
        }
      } else {
        // Dados genéricos
        Object.entries(item).forEach(([key, value]) => {
          csvItem[key] = value;
        });
      }
      
      return csvItem;
    });

    return Papa.unparse(csvData);
  }

  public generatePdfReport(data: any, reportTitle: string = 'Dados'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers: any[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Título centralizado
        doc.fontSize(20).font('Helvetica-Bold').text('RADE CHATBOT', { align: 'center' });
        doc.moveDown(0.5);

        // Linha decorativa
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.moveTo(doc.page.margins.left, doc.y)
           .lineTo(doc.page.margins.left + pageWidth, doc.y)
           .stroke();
        doc.moveDown(1.5);

        // Conteúdo formatado (alinhado à esquerda)
        const content = this.formatDataForDisplayPDF(data, reportTitle);
        doc.fontSize(11).font('Helvetica').text(content, { align: 'left' });

        // Rodapé - posicionar no final da página
        const bottomMargin = 50;
        const footerY = doc.page.height - bottomMargin - 20;

        doc.y = footerY;

        // Linha fina no rodapé
        doc.moveTo(doc.page.margins.left, doc.y)
           .lineTo(doc.page.margins.left + pageWidth, doc.y)
           .lineWidth(0.5)
           .stroke();

        doc.moveDown(0.5);

        // Data de geração (centralizada e pequena)
        const dataGeracao = new Date().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        doc.fontSize(8).font('Helvetica').fillColor('#666666')
           .text(`Gerado em ${dataGeracao}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
} 