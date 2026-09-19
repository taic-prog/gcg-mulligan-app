import { useEffect, useRef } from 'react';

// モーダル共通のアクセシビリティ対応:
// - マウント時に閉じるボタンへフォーカスを移動
// - Escapeキーで閉じる
// - アンマウント時に開く直前のフォーカスへ復元する
export function useModalA11y(onClose: () => void) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return closeButtonRef;
}
