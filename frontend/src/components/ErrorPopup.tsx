import { Modal } from "./Modal";

export function ErrorPopup({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal title="خطأ" onClose={onClose}>
      <div className="grid">
        <div className="muted">{message}</div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btnPrimary" onClick={onClose}>
            حسناً
          </button>
        </div>
      </div>
    </Modal>
  );
}
