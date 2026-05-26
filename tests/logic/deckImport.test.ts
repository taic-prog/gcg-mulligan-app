import { describe, expect, it } from 'vitest';
import { parseDeckText } from '../../src/logic/deckImport';

describe('parseDeckText', () => {
  it('基本フォーマット: cardNo + 枚数', () => {
    const result = parseDeckText('GD01-001 3');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 3 }]);
  });

  it('x プレフィックス付き枚数', () => {
    const result = parseDeckText('GD01-001 x4');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 4 }]);
  });

  it('X プレフィックス大文字', () => {
    const result = parseDeckText('GD01-001 X2');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 2 }]);
  });

  it('枚数が先頭に来るフォーマット', () => {
    const result = parseDeckText('3 GD01-001');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 3 }]);
  });

  it('枚数省略時は1枚', () => {
    const result = parseDeckText('GD01-001');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 1 }]);
  });

  it('cardNo を大文字に正規化する', () => {
    const result = parseDeckText('gd01-001 2');
    expect(result[0].cardNo).toBe('GD01-001');
  });

  it('# コメント行をスキップ', () => {
    const result = parseDeckText('# コメント\nGD01-001 2');
    expect(result).toHaveLength(1);
    expect(result[0].cardNo).toBe('GD01-001');
  });

  it('// コメント行をスキップ', () => {
    const result = parseDeckText('// comment\nGD01-002 1');
    expect(result).toHaveLength(1);
  });

  it('空行をスキップ', () => {
    const result = parseDeckText('\n\nGD01-001 1\n\n');
    expect(result).toHaveLength(1);
  });

  it('カードNo.が含まれない行をスキップ', () => {
    const result = parseDeckText('これはデッキです\nGD01-001 1');
    expect(result).toHaveLength(1);
  });

  it('複数行を正しく解析', () => {
    const text = 'GD01-001 3\nGD01-002 x2\nGD01-003';
    const result = parseDeckText(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ cardNo: 'GD01-001', count: 3 });
    expect(result[1]).toEqual({ cardNo: 'GD01-002', count: 2 });
    expect(result[2]).toEqual({ cardNo: 'GD01-003', count: 1 });
  });

  it('同一cardNo が複数行にある場合は合算', () => {
    const text = 'GD01-001 2\nGD01-001 1';
    const result = parseDeckText(text);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('同一cardNo の合算が4枚を超えても4枚に丸められる', () => {
    const text = 'GD01-001 3\nGD01-001 3';
    const result = parseDeckText(text);
    expect(result[0].count).toBe(4);
  });

  it('枚数が4を超える場合も4に丸められる', () => {
    const result = parseDeckText('GD01-001 9');
    expect(result[0].count).toBe(4);
  });

  it('ST形式のcardNoを解析', () => {
    const result = parseDeckText('ST01-001 4');
    expect(result).toEqual([{ cardNo: 'ST01-001', count: 4 }]);
  });

  it('短いcardNo形式（ハイフン前の数字なし）を解析', () => {
    const result = parseDeckText('R-002 1');
    expect(result).toEqual([{ cardNo: 'R-002', count: 1 }]);
  });

  it('空文字列は空配列を返す', () => {
    expect(parseDeckText('')).toEqual([]);
  });

  it('Windows改行(\\r\\n)に対応', () => {
    const result = parseDeckText('GD01-001 2\r\nGD01-002 3');
    expect(result).toHaveLength(2);
  });

  it('全角スペース区切りに対応', () => {
    const result = parseDeckText('GD01-001　2');
    expect(result).toEqual([{ cardNo: 'GD01-001', count: 2 }]);
  });
});
