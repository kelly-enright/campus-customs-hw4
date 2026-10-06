import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { login, user, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>You're logged in</h1>
          <p className="auth-intro">
            Signed in as <strong>{user.email}</strong>.
          </p>
          <Link className="btn btn-navy" to="/products">
            Start shopping
          </Link>
          <p className="form-note">
            Not you?{" "}
            <button className="link-button" onClick={logout}>
              Log out
            </button>
          </p>
        </div>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate("/products");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log you in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-card">
        <h1>Log in</h1>
        <p className="auth-intro">
          Welcome back. Log in to pick up where you left off with the assistant.
        </p>

        {error && <p className="notice notice-error">{error}</p>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <button className="btn btn-navy" type="submit" disabled={pending}>
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="form-note">
          New to Campus Customs? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
