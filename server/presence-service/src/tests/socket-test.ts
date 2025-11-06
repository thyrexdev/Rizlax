import { io } from "socket.io-client";

const socket = io("http://localhost:5003", {
  auth: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwODQ2YmQzZi0xZTg4LTRkNWUtYmE1Yi01M2MwZGUzMTQzYmQiLCJlbWFpbCI6InRlc3RpbmdAdGVzdC5jb20iLCJyb2xlIjoiRlJFRUxBTkNFUiIsImlhdCI6MTc2MjQzNjAwNiwiZXhwIjoxNzYyNDM2OTA2fQ.1fWOFebHKCIyuP_Vdf4Y6azWBApjffcj2B-gzrJm9zU",
    userId: "0846bd3f-1e88-4d5e-ba5b-53c0de3143bd"
  }
});

socket.on("connect", () => {
  console.log("✅ Connected to presence socket:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});

socket.on("disconnect", () => {
  console.log("🛑 Disconnected");
});
