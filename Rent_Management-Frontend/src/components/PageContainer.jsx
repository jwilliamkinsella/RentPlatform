import { colors } from "@mui/material";

export default function PageContainer({ title, children, fullWidth = false }) {
  const baseStyle = {
  textAlign: fullWidth ? "left" : "center",
  padding: fullWidth ? "0" : "30px",
  borderRadius: fullWidth ? "0" : "12px",
  boxShadow: fullWidth ? "none" : "0 4px 15px rgba(26, 13, 13, 0.53)",
  maxWidth: fullWidth ? "100%" : "420px",
  margin: fullWidth ? "0" : "8% auto",
  minHeight: fullWidth ? "100vh" : "auto",
  backgroundColor: fullWidth ? "transparent" : "#ffffff",
  color: "#0c0707",
};
  return (
    <div style={baseStyle}>
      {title && !fullWidth && (
        <h2
          style={{
            marginBottom: "20px",
            color: "#0c0202e8",
            fontWeight: 650,
            textAlign: "center",
            backgroundColor: "#f3f4f6",
            borderRadius: fullWidth ? "0" : "12px",
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
