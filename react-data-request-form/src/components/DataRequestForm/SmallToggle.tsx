import React from "react";
import { Box, Typography } from "@mui/material";

interface SmallToggleProps {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inline?: boolean;
}

const SmallToggle: React.FC<SmallToggleProps> = ({ 
    leftLabel, rightLabel, checked, onChange, inline = false }) => {
        const containerStyle = {
            display: "flex",
            backgroundColor: "#ebebeb",
            borderRadius: "12px",
            padding: "2px",
            gap: "2px",
            width: "fit-content",
        };
        const buttonStyle = (isActive: boolean) => ({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "3px 10px",
            borderRadius: "9px",
            backgroundColor: isActive ? "#ffffff" : "transparent",
            color: isActive ? "#000000" : "#888888",
            fontWeight: isActive ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            fontSize: "0.75rem",
            whiteSpace: "nowrap" as const,
            boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
        });
        return (
            <Box
            display={inline ? "inline-flex" : "flex"}
            alignItems="center"
            sx={{
                ...(inline ? { marginLeft: "0.75rem" } : { marginTop: "0.5rem" }),
            }}
            >
            <Box sx={containerStyle}>
                <Box
                sx={{
                    ...buttonStyle(!checked),
                    borderRight: "none",
                }}
                onClick={() =>
                    onChange({
                    target: { checked: false },
                    } as React.ChangeEvent<HTMLInputElement>)
                }
                >
                <Typography variant="body2" fontWeight="inherit">{leftLabel}</Typography>
                </Box>
                <Box
                sx={buttonStyle(checked)}
                onClick={() =>
                    onChange({
                    target: { checked: true },
                    } as React.ChangeEvent<HTMLInputElement>)
                }
                >
                <Typography variant="body2" fontWeight="inherit">{rightLabel}</Typography>
                </Box>
            </Box>
            </Box>
        );
    };

export default SmallToggle;
