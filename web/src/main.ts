import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { keepAppUpToDate } from './lib/updates.ts'

mount(App, { target: document.getElementById('app')! })
keepAppUpToDate()
