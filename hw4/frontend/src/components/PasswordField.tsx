import { useState } from "react";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="toggle-visibility"
          onClick={() => setVisible((prev) => !prev)}
          aria-pressed={visible}
        >
          {visible ? "Hide password" : "Show password"}
        </button>
      </div>
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
