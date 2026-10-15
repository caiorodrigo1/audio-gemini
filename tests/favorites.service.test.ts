import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FavoritesService } from '../src/web/favorites.service';

describe('FavoritesService', () => {
  const file = () => join(mkdtempSync(join(tmpdir(), 'ag-fav-')), 'sub', 'favorites.json');

  it('returns an empty list when nothing was saved', () => {
    expect(new FavoritesService(file()).list()).toEqual([]);
  });

  it('persists ids to disk, dropping duplicates and non-strings', () => {
    const path = file();
    expect(new FavoritesService(path).save(['pt-br-a', 'charon', 'pt-br-a', 3, ''])).toEqual(['pt-br-a', 'charon']);
    expect(new FavoritesService(path).list()).toEqual(['pt-br-a', 'charon']);
  });

  it('rejects a payload that is not a list', () => {
    expect(() => new FavoritesService(file()).save('charon')).toThrow();
  });
});
