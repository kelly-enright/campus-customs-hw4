import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import { useAuth } from "../lib/AuthContext";

const MIN_PASSWORD_LENGTH = 8;

export default function Signup() {
  const { signup, user, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>You already have an account</h1>
          <p className="auth-intro">
            Signed in as <strong>{user.email}</strong>.
          </p>
          <Link className="btn btn-navy" to="/products">
            Start shopping
          </Link>
          <p className="form-note">
            Want a different account?{" "}
            <button className="link-button" onClick={logout}>
              Log out
            </button>
          </p>
        </div>
      </div>
    );
  }

  function update(field: keyof typeof form) {
    return (value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  }

  const mismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Checked here as well as on the server, so the mistake is caught before the
    // password ever leaves the browser.
    if (form.password !== form.confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending(true);
    try {
      await signup({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      });
      navigate("/products");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-card">
        <h1>Create an account</h1>
        <p className="auth-intro">
          Save your conversations with the assistant and keep your sizes handy.
        </p>

        {error && <p className="notice notice-error">{error}</p>}

        <form onSubmit={submit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="signup-first">First name</label>
              <input
                id="signup-first"
                autoComplete="given-name"
                required
                value={form.firstName}
                onChange={(event) => update("firstName")(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-last">Last name</label>
              <input
                id="signup-last"
                autoComplete="family-name"
                required
                value={form.lastName}
                onChange={(event) => update("lastName")(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => update("email")(event.target.value)}
            />
          </div>

          <PasswordField
            id="signup-password"
            label="Password"
            value={form.password}
            onChange={update("password")}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />

          <PasswordField
            id="signup-confirm"
            label="Confirm password"
            value={form.confirmPassword}
            onChange={update("confirmPassword")}
            autoComplete="new-password"
          />

          {mismatch && <p className="field-error">Those passwords don't match.</p>}

          <button className="btn btn-navy" type="submit" disabled={pending || mismatch}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="form-note">
          Already have one? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
