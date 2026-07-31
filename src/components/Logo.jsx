export default function Logo({ className = "", title = "Hashmi Network" }) {
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
