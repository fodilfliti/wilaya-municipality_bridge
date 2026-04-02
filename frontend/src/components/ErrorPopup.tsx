import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";

export function ErrorPopup({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={t("error")} onClose={onClose}>
      <div className="grid">
        <div className="muted">{message}</div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btnPrimary" onClick={onClose}>
            {t("ok")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
