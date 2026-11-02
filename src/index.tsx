import { createApp } from 'vue';
import App from './App.tsx';
import './styles.css';

// 挂载Vue应用到DOM
const app = createApp(App);
app.mount('#root');
