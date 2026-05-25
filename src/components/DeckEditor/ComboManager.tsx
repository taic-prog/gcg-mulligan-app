import { useState } from 'react';
import { useDeckStoreCtx } from '../../store/DeckStoreContext';
import type { ComboCondition } from '../../types';
import ComboCalculator from '../common/ComboCalculator';
import styles from './ComboManager.module.css';

export default function ComboManager() {
  const { activeDeck, addCombo, updateCombo, deleteCombo } = useDeckStoreCtx();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCondition, setEditingCondition] = useState<ComboCondition | null>(null);

  if (!activeDeck) return null;

  const { combos, entries } = activeDeck;

  function startNew() {
    setEditingId('new');
    setEditingName('新コンボ');
    setEditingCondition(null);
  }

  function startEdit(comboId: string) {
    const combo = combos.find((c) => c.id === comboId);
    if (!combo) return;
    setEditingId(comboId);
    setEditingName(combo.name);
    setEditingCondition(null); // ComboCalculator が key 変更で再マウントして initialCondition から読む
  }

  function handleSave() {
    if (!editingCondition) return;
    const name = editingName.trim() || '新コンボ';
    if (editingId === 'new') {
      addCombo({ name, condition: editingCondition });
    } else if (editingId) {
      updateCombo(editingId, { name, condition: editingCondition });
    }
    setEditingId(null);
  }

  function handleCancel() {
    setEditingId(null);
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>コンボ管理</p>

      {combos.length === 0 && editingId === null && (
        <p className={styles.empty}>コンボが登録されていません</p>
      )}

      {/* 登録済みコンボ一覧 */}
      {combos.length > 0 && (
        <ul className={styles.comboList}>
          {combos.map((combo) => (
            <li key={combo.id} className={styles.comboItem}>
              <div className={styles.comboInfo}>
                <span className={styles.comboName}>{combo.name}</span>
                <span className={styles.comboMeta}>
                  すべて成立 ／ {combo.condition.items.length} 条件
                </span>
              </div>
              <div className={styles.comboActions}>
                <button
                  className={styles.btnEdit}
                  onClick={() => startEdit(combo.id)}
                  disabled={editingId !== null}
                >
                  編集
                </button>
                <button
                  className={styles.btnDelete}
                  onClick={() => deleteCombo(combo.id)}
                  disabled={editingId !== null}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 追加ボタン */}
      {editingId === null && (
        <button
          className={styles.btnAdd}
          onClick={startNew}
          disabled={entries.length === 0}
        >
          ＋ コンボを追加
        </button>
      )}

      {/* 編集フォーム */}
      {editingId !== null && (
        <div className={styles.editor}>
          <div className={styles.nameRow}>
            <label className={styles.nameLabel}>コンボ名</label>
            <input
              className={styles.nameInput}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="コンボ名を入力"
            />
          </div>

          <ComboCalculator
            key={editingId}
            entries={entries}
            initialCondition={
              editingId !== 'new'
                ? combos.find((c) => c.id === editingId)?.condition
                : undefined
            }
            showProbability={false}
            onConditionChange={setEditingCondition}
          />

          <div className={styles.editorFooter}>
            <button
              className={styles.btnSave}
              onClick={handleSave}
              disabled={!editingCondition}
            >
              保存
            </button>
            <button className={styles.btnCancel} onClick={handleCancel}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
