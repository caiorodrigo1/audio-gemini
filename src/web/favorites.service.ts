import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Vozes favoritas, salvas em disco para valerem fora do navegador
 * (o historia-clips lê daqui para escolher a voz pela língua do MD).
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly file: string = process.env.FAVORITES_FILE ?? join(process.cwd(), '.data', 'favorites.json'),
  ) {}

  list(): string[] {
    if (!existsSync(this.file)) return [];
    try {
      const ids = JSON.parse(readFileSync(this.file, 'utf8'));
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  save(ids: unknown): string[] {
    if (!Array.isArray(ids)) throw new Error('favorites deve ser uma lista de ids');
    const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(clean, null, 2));
    return clean;
  }
}
