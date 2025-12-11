import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Streamdown } from 'streamdown';

@Injectable()
export class StreamdownService {
  render(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const element = React.createElement(Streamdown as any, { mode: 'static' }, content);
    return renderToStaticMarkup(element);
  }
}

