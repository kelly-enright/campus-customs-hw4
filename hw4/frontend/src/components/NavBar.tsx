import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBag } from "../lib/BagContext";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Products" },
  { to: "/about", label: "About Us" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { count } = useBag();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate("/");
  }

  return (
    <header className="nav">
      <nav className="nav-inner" aria-label="Main">
        <NavLink to="/" className="nav-brand">
          <strong>Campus Customs</strong>
          <span>New Haven, CT</span>
        </NavLink>

        <div className="nav-links">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}

          <NavLink
            to="/bag"
            className={({ isActive }) => (isActive ? "nav-link active nav-bag" : "nav-link nav-bag")}
          >
            Bag
            {count > 0 && <span className="bag-count">{count}</span>}
          </NavLink>

          {user ? (
            <>
              <span className="nav-greeting">
                Hi, {user.first_name?.trim() || user.name.split(" ")[0]}
              </span>
              <button className="nav-link nav-signout" onClick={signOut}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Log In
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  isActive ? "nav-link nav-cta active" : "nav-link nav-cta"
                }
              >
                Create Account
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
