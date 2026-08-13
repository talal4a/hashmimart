export default function Logo({ className = "", title = "Hashmi Mart" }) {
  return (
    <img
      src="/logo-black.png"
      alt={title}
      className={className}
      style={{
        background: "transparent",
        objectFit: "contain",
      }}
    />
  );
}
