export default function Logo({
  size = 32,
  className = "",
  title = "Hashmi Network",
}) {
  return (
    <img
      src="/logo-black.png"
      alt={title}
      width={size}
      height={size}
      className={className}
      style={{
        background: "transparent",
        objectFit: "contain",
      }}
    />
  );
}
