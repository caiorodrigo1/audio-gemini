import { Injectable } from '@nestjs/common';

@Injectable()
export class TextService {
  processLongText(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach(sentence => {
      console.log(`Processing: ${sentence.trim()}`);
    });
    
    console.log(`Processed ${sentences.length} sentences with ${text.length} characters`);
    return 'OK';
  }
}