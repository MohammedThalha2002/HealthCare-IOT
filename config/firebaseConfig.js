// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCpvr-jvHb-jxs7QFM8aGmp9OV-7sjHbNs",
  authDomain: "healthcare-iot-e7f99.firebaseapp.com",
  databaseURL:
    "https://healthcare-iot-e7f99-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "healthcare-iot-e7f99",
  storageBucket: "healthcare-iot-e7f99.appspot.com",
  messagingSenderId: "439424999890",
  appId: "1:439424999890:web:ffdd9e249a725a1d3ca80b",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
