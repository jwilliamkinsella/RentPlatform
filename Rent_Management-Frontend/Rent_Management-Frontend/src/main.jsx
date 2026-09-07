import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import './index.css';


const theme = createTheme({
  palette: {
    primary: {
      main: "#a3a8ad", 
    },
    secondary: {
      main: "#829290",
    },
  },
  typography: {
    fontFamily: "Segoe UI, Arial, sans-serif",
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> 
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
