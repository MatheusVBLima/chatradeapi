import { Injectable } from '@nestjs/common';
import { Streamdown } from 'streamdown';

@Injectable()
export class StreamdownService {
  private readonly streamdown = new Streamdown();

  render(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Streamdown retorna HTML; mantemos simples para uso direto no front.
    return this.streamdown.render(content);
  }
}

