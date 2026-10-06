import DanPeek from "./DanPeek";

export default function Footer() {
  return (
    <footer className="footer">
      {/* the pups look over the top rail of the footer */}
      <DanPeek />
      <div className="footer-inner">
        <span>© {new Date().getFullYear()} Campus Customs · New Haven, Connecticut</span>
        <span>
          Questions? Ask the Campus Customs assistant, bottom right of any page.
        </span>
      </div>
    </footer>
  );
}
