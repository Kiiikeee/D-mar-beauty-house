import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj1Zu9LJoUmsvxcZAE4DiNf6UgrpfLg2Q",
  authDomain: "d-mar-beauty-house-app.firebaseapp.com",
  projectId: "d-mar-beauty-house-app",
  storageBucket: "d-mar-beauty-house-app.firebasestorage.app",
  messagingSenderId: "527727838907",
  appId: "1:527727838907:web:183ab78809eee1ee4d4b9e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productosRef = collection(db, "productos");
const serviciosRef = collection(db, "servicios");
const pagosRef = collection(db, "pagos_creditos");
const ventasRef = collection(db, "ventas_historial");
const permanenteRef = collection(db, "historial_permanente");
const comisionesRef = collection(db, "comisiones_estilistas");
const recibosRef = collection(db, "recibos_historial");

function formatearQ(monto) {
    const val = parseFloat(monto) || 0;
    return 'Q' + val.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let listaProductosCache = [];
let listaServiciosCache = [];
let listaPagosCache = [];
let listaVentasCache = [];
let listaPermanenteCache = [];
let listaComisionesCache = [];
let listaRecibosCache = [];

let ticketPOSActual = { idReciboExistente: null, items: [] };

const tablaProductos = document.getElementById('tabla-productos');
const tablaServicios = document.getElementById('tabla-servicios');
const tablaPagos = document.getElementById('tabla-pagos');
const tablaVentasHistorial = document.getElementById('tabla-ventas-historial');
const contenedorPermanente = document.getElementById('contenedor-historial-permanente');
const tablaCorrecciones = document.getElementById('tabla-correcciones');
const tablaPosItems = document.getElementById('tabla-pos-items');
const tablaRecibosHistorial = document.getElementById('tabla-recibos-historial');

function confirmarAccion(mensaje, callback) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-mensaje').textContent = mensaje;
    modal.style.display = 'flex';
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const limpiar = () => { modal.style.display = 'none'; btnOk.onclick = null; btnCancel.onclick = null; };
    btnOk.onclick = () => { limpiar(); callback(); };
    btnCancel.onclick = limpiar;
}

window.toggleMenu = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
};

window.abrirModalChangelog = () => {
    document.getElementById('modal-changelog').style.display = 'flex';
    const badge = document.querySelector('.bell-badge');
    if (badge) badge.style.display = 'none';
};

window.cerrarModalChangelog = () => { document.getElementById('modal-changelog').style.display = 'none'; };

window.toggleCamposAbonoPOS = () => {
    const estado = document.getElementById('pos-estado-pago').value;
    const contAbono = document.getElementById('contenedor-pos-abono');
    const contCheckboxes = document.getElementById('contenedor-items-pendientes-checkbox');
    const listaCheckboxes = document.getElementById('lista-checkboxes-pendientes');
    const boxDeuda = document.getElementById('box-deuda-saldo');

    if (estado === 'CREDITO') {
        contAbono.style.display = 'block';
        contCheckboxes.style.display = 'block';
        boxDeuda.style.display = 'block';
        listaCheckboxes.innerHTML = '';
        if (ticketPOSActual.items.length === 0) {
            listaCheckboxes.innerHTML = `<small style="color:#aaa;">No hay ítems en la ficha para seleccionar.</small>`;
            return;
        }
        ticketPOSActual.items.forEach((item, index) => {
            const divOption = document.createElement('div');
            divOption.style.cssText = `display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #fff;`;
            divOption.innerHTML = `
                <input type="checkbox" id="chk-pendiente-${index}" data-index="${index}" style="width: auto; cursor: pointer;" onchange="alCambiarCheckboxPendientePOS()">
                <label for="chk-pendiente-${index}" style="cursor: pointer; font-weight: 500;">
                    ${item.nombre} - <span style="color:#81c784; font-weight:bold;">${formatearQ(item.subtotal)}</span>
                </label>
            `;
            listaCheckboxes.appendChild(divOption);
        });
        alCambiarCheckboxPendientePOS();
    } else {
        contAbono.style.display = 'none';
        contCheckboxes.style.display = 'none';
        boxDeuda.style.display = 'none';
        document.getElementById('pos-monto-abono').value = '';
        actualizarSumaDinamicaPOS();
    }
};

window.alCambiarCheckboxPendientePOS = () => {
    let sumaPendiente = 0;
    let totalTicket = 0;
    ticketPOSActual.items.forEach((item, index) => {
        totalTicket += item.subtotal;
        const chk = document.getElementById(`chk-pendiente-${index}`);
        if (chk && chk.checked) sumaPendiente += item.subtotal;
    });
    const abonoSugerido = Math.max(0, totalTicket - sumaPendiente);
    document.getElementById('pos-monto-abono').value = abonoSugerido > 0 ? abonoSugerido.toFixed(2) : '';
    actualizarSumaDinamicaPOS();
};

window.actualizarSumaDinamicaPOS = () => {
    let totalTicket = 0;
    ticketPOSActual.items.forEach(i => totalTicket += i.subtotal);
    const estado = document.getElementById('pos-estado-pago').value;
    let abonoVal = estado === 'CREDITO' ? (parseFloat(document.getElementById('pos-monto-abono').value) || 0) : totalTicket;
    const saldoDeuda = Math.max(0, totalTicket - abonoVal);
    document.getElementById('pos-total-monto').textContent = formatearQ(totalTicket);
    document.getElementById('pos-cobro-hoy-monto').textContent = formatearQ(abonoVal);
    document.getElementById('pos-deuda-monto').textContent = formatearQ(saldoDeuda);
};

window.navegarA = (seccion) => {
    const secciones = ['ficha', 'recibos', 'inventario', 'servicios', 'estilistas', 'pagos', 'reportes', 'permanente', 'correcciones'];
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    secciones.forEach(s => { const sec = document.getElementById(`seccion-${s}`); if (sec) sec.style.display = 'none'; });
    document.body.className = `theme-${seccion}`;
    const actual = document.getElementById(`seccion-${seccion}`);
    if (actual) actual.style.display = 'block';
    const menuBtn = document.getElementById(`menu-btn-${seccion}`);
    if (menuBtn) menuBtn.classList.add('active');
    toggleMenu();
};

function mostrarNotificacion(mensaje, tipo = 'exito') {
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        contenedor.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;`;
        document.body.appendChild(contenedor);
    }
    const toast = document.createElement('div');
    toast.textContent = mensaje;
    toast.style.cssText = `background-color: ${tipo === 'exito' ? '#2e7d32' : '#c62828'}; color: #fff; padding: 12px 20px; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); opacity: 0; transition: all 0.3s ease;`;
    contenedor.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

window.abrirModalAgregarServicioPOS = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const datalistServ = document.getElementById('lista-servicios-datalist');
    datalistServ.innerHTML = '';
    listaServiciosCache.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}`;
        datalistServ.appendChild(opt);
    });
    document.getElementById('pos-input-servicio').value = '';
    document.getElementById('pos-item-precio-serv').value = '';
    document.getElementById('pos-item-estilista').value = document.getElementById('pos-estilista-defecto').value.trim().toUpperCase() || 'GENERAL';
    document.getElementById('modal-pos-servicio').style.display = 'flex';
};

document.getElementById('pos-input-servicio').addEventListener('input', (e) => {
    const texto = e.target.value.trim().toUpperCase();
    const encontrado = listaServiciosCache.find(s => `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}` === texto || s.nombre.toUpperCase() === texto);
    if (encontrado) document.getElementById('pos-item-precio-serv').value = encontrado.precio;
});

window.cerrarModalAgregarServicioPOS = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-pos-servicio').style.display = 'none'; };

document.getElementById('form-pos-servicio').addEventListener('submit', (e) => {
    e.preventDefault();
    const textoInput = document.getElementById('pos-input-servicio').value.trim().toUpperCase();
    if (!textoInput) return;
    let servicioSeleccionado = listaServiciosCache.find(s => `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}` === textoInput || s.nombre.toUpperCase() === textoInput);
    const nombreServ = servicioSeleccionado ? servicioSeleccionado.nombre.toUpperCase() : textoInput.split('-')[0].trim();
    const estilista = document.getElementById('pos-item-estilista').value.trim().toUpperCase() || 'GENERAL';
    let precio = parseFloat(document.getElementById('pos-item-precio-serv').value);
    if (isNaN(precio) || precio <= 0) precio = servicioSeleccionado ? parseFloat(servicioSeleccionado.precio) : 0;

    ticketPOSActual.items.push({ tipo: 'SERVICIO', idRef: servicioSeleccionado ? servicioSeleccionado.id : null, nombre: nombreServ, estilista: estilista, cantidad: 1, precioUnitario: precio, subtotal: precio, comision: precio * 0.30 });
    renderizarTicketPOS();
    cerrarModalAgregarServicioPOS();
});

function buscarProductoEnCache(texto) {
    if (!texto) return null;
    const txtLimpio = texto.trim().toUpperCase();
    let encontrado = listaProductosCache.find(p => `${p.nombre.toUpperCase()} - STOCK: ${p.stock} - ${formatearQ(p.precio)}` === txtLimpio || p.nombre.toUpperCase() === txtLimpio || p.codigo.toUpperCase() === txtLimpio);
    if (!encontrado) {
        const parteNombre = txtLimpio.split('-')[0].trim();
        encontrado = listaProductosCache.find(p => p.nombre.toUpperCase() === parteNombre || p.nombre.toUpperCase().includes(parteNombre));
    }
    return encontrado;
}

window.abrirModalAgregarProductoPOS = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const datalistProd = document.getElementById('lista-productos-datalist');
    datalistProd.innerHTML = '';
    listaProductosCache.forEach(p => {
        if (p.stock > 0) {
            const opt = document.createElement('option');
            opt.value = `${p.nombre.toUpperCase()} - Stock: ${p.stock} - ${formatearQ(p.precio)}`;
            datalistProd.appendChild(opt);
        }
    });
    document.getElementById('pos-input-producto').value = '';
    document.getElementById('pos-item-precio-prod').value = '';
    document.getElementById('pos-item-cant-prod').value = 1;
    document.getElementById('modal-pos-producto').style.display = 'flex';
};

function recargaPrecioDinamicoProductoPOS() {
    const texto = document.getElementById('pos-input-producto').value;
    const cant = parseInt(document.getElementById('pos-item-cant-prod').value) || 1;
    const prodEncontrado = buscarProductoEnCache(texto);
    if (prodEncontrado) {
        document.getElementById('pos-item-precio-prod').value = (parseFloat(prodEncontrado.precio) * cant).toFixed(2);
    }
}

document.getElementById('pos-input-producto').addEventListener('input', recargaPrecioDinamicoProductoPOS);
document.getElementById('pos-item-cant-prod').addEventListener('input', recargaPrecioDinamicoProductoPOS);

window.cerrarModalAgregarProductoPOS = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-pos-producto').style.display = 'none'; };

document.getElementById('form-pos-producto').addEventListener('submit', (e) => {
    e.preventDefault();
    const textoInput = document.getElementById('pos-input-producto').value.trim();
    if (!textoInput) return;
    const prodSeleccionado = buscarProductoEnCache(textoInput);
    const cant = parseInt(document.getElementById('pos-item-cant-prod').value) || 1;
    if (prodSeleccionado && cant > prodSeleccionado.stock) { mostrarNotificacion('⚠️ La cantidad supera el stock disponible.', 'error'); return; }
    let subtotalIngresado = parseFloat(document.getElementById('pos-item-precio-prod').value);
    let precioUnitarioCalc = (!isNaN(subtotalIngresado) && subtotalIngresado > 0) ? (subtotalIngresado / cant) : (prodSeleccionado ? parseFloat(prodSeleccionado.precio) : 0);
    const subtotalFinal = precioUnitarioCalc * cant;
    if (subtotalFinal <= 0) { mostrarNotificacion('⚠️ Verifique el precio.', 'error'); return; }
    const nombreProd = prodSeleccionado ? prodSeleccionado.nombre.toUpperCase() : textoInput.split('-')[0].trim().toUpperCase();

    ticketPOSActual.items.push({ tipo: 'PRODUCTO', idRef: prodSeleccionado ? prodSeleccionado.id : null, nombre: nombreProd, estilista: 'N/A', cantidad: cant, precioUnitario: precioUnitarioCalc, subtotal: subtotalFinal, comision: 0 });
    renderizarTicketPOS();
    cerrarModalAgregarProductoPOS();
});

function renderizarTicketPOS() {
    tablaPosItems.innerHTML = '';
    if (ticketPOSActual.items.length === 0) {
        tablaPosItems.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888;">No ha agregado ningún trabajo o producto a esta ficha.</td></tr>`;
        actualizarSumaDinamicaPOS();
        return;
    }
    ticketPOSActual.items.forEach((item, index) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><span style="font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:4px; background:${item.tipo === 'SERVICIO' ? 'rgba(232,165,200,0.2)' : 'rgba(212,175,55,0.2)'}; color:${item.tipo === 'SERVICIO' ? '#e8a5c8' : '#d4af37'};">${item.tipo}</span></td>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.estilista}</td>
            <td style="text-align: center;">${item.cantidad}</td>
            <td style="text-align: center;">${formatearQ(item.precioUnitario)}</td>
            <td style="text-align: center; font-weight: bold;">${formatearQ(item.subtotal)}</td>
            <td style="text-align: center;"><button onclick="quitarItemTicketPOS(${index})" style="background:#c62828; color:white; border:none; border-radius:4px; padding:3px 8px; cursor:pointer; font-size:11px;">✕</button></td>
        `;
        tablaPosItems.appendChild(fila);
    });
    if (document.getElementById('pos-estado-pago').value === 'CREDITO') toggleCamposAbonoPOS();
    else actualizarSumaDinamicaPOS();
}

window.quitarItemTicketPOS = (index) => { ticketPOSActual.items.splice(index, 1); renderizarTicketPOS(); };

window.confirmarYGuardarReciboPOS = async () => {
    if (ticketPOSActual.items.length === 0) { mostrarNotificacion('⚠️ La ficha de atención está vacía.', 'error'); return; }
    const cliente = document.getElementById('pos-cliente').value.trim().toUpperCase() || 'CLIENTE GENERAL';
    const metodo = document.getElementById('pos-metodo-pago').value;
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mesAnioStr = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    const timestampUni = ahora.getTime();

    let totalTicket = 0;
    ticketPOSActual.items.forEach(i => totalTicket += i.subtotal);
    const estadoPago = document.getElementById('pos-estado-pago').value;
    let abonoHoy = estadoPago === 'CREDITO' ? (parseFloat(document.getElementById('pos-monto-abono').value) || 0) : totalTicket;
    let itemsPendientesDetalle = [];

    if (estadoPago === 'CREDITO') {
        ticketPOSActual.items.forEach((item, idx) => {
            const chk = document.getElementById(`chk-pendiente-${idx}`);
            if (chk && chk.checked) itemsPendientesDetalle.push({ nombre: item.nombre, monto: item.subtotal });
        });
        if (itemsPendientesDetalle.length === 0) itemsPendientesDetalle = ticketPOSActual.items.map(i => ({ nombre: i.nombre, monto: i.subtotal }));
    }

    const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);
    const saldoPendienteCalc = Math.max(0, totalTicket - abonoHoy);

    const reciboData = {
        numRecibo, cliente, metodo, total: totalTicket, abonoInicial: abonoHoy, saldoPendiente: saldoPendienteCalc,
        estadoPago: estadoPago === 'CREDITO' ? (saldoPendienteCalc <= 0 ? 'PAGADO' : 'PENDIENTE') : 'PAGADO',
        itemsPendientes: itemsPendientesDetalle, fecha: fechaStr, mesAnio: mesAnioStr, timestamp: timestampUni, items: ticketPOSActual.items
    };

    try {
        if (ticketPOSActual.idReciboExistente) await deleteDoc(doc(db, "recibos_historial", ticketPOSActual.idReciboExistente));
        await addDoc(recibosRef, reciboData);

        if (saldoPendienteCalc > 0) {
            await addDoc(pagosRef, {
                cliente, numRecibo, itemsPendientes: itemsPendientesDetalle, montoTotal: totalTicket, montoPagado: abonoHoy,
                saldoPendiente: saldoPendienteCalc, fecha: fechaStr, mesAnio: mesAnioStr, timestamp: timestampUni, estado: 'PENDIENTE',
                historialAbonos: abonoHoy > 0 ? [{ fecha: fechaStr, monto: abonoHoy, metodo }] : []
            });
        }

        for (const item of ticketPOSActual.items) {
            const conceptoStr = item.tipo === 'SERVICIO' ? `SERVICIO: ${item.nombre}` : `${item.nombre} (x${item.cantidad})`;
            const montoParaCaja = estadoPago === 'COMPLETO' ? item.subtotal : (totalTicket > 0 ? (item.subtotal / totalTicket) * abonoHoy : 0);

            const transaccion = { numRecibo, tipo: item.tipo === 'SERVICIO' ? 'SERVICIO' : 'INGRESO', concepto: conceptoStr, estilista: item.estilista, cliente, productoId: item.tipo === 'PRODUCTO' ? item.idRef : null, cantidadVendida: item.cantidad, monto: montoParaCaja, precioTotal: item.subtotal, comision: item.comision, metodo, fecha: fechaStr, mesAnio: mesAnioStr, timestamp: timestampUni };

            await addDoc(ventasRef, transaccion);
            await addDoc(permanenteRef, transaccion);
            if (item.tipo === 'SERVICIO' && item.estilista) await addDoc(comisionesRef, transaccion);
            if (item.tipo === 'PRODUCTO' && item.idRef) {
                const prodDoc = listaProductosCache.find(p => p.id === item.idRef);
                if (prodDoc) await updateDoc(doc(db, "productos", item.idRef), { stock: Math.max(0, prodDoc.stock - item.cantidad) });
            }
        }

        ticketPOSActual = { idReciboExistente: null, items: [] };
        document.getElementById('pos-cliente').value = '';
        document.getElementById('pos-estado-pago').value = 'COMPLETO';
        toggleCamposAbonoPOS();
        renderizarTicketPOS();
        mostrarNotificacion(`✨ Comprobante ${numRecibo} guardado exitosamente.`, 'exito');
    } catch (error) { mostrarNotificacion('❌ Error al guardar.', 'error'); }
};

onSnapshot(pagosRef, (snapshot) => {
    listaPagosCache = [];
    snapshot.forEach(docSnap => listaPagosCache.push({ id: docSnap.id, ...docSnap.data() }));
    renderizarPagos();
});

function renderizarPagos() {
    tablaPagos.innerHTML = '';
    const texto = document.getElementById('buscador-pagos').value.toLowerCase().trim();
    const filtrados = listaPagosCache.filter(p => !texto || (p.cliente || '').toLowerCase().includes(texto));
    if (filtrados.length === 0) { tablaPagos.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888;">No hay saldos pendientes.</td></tr>`; return; }

    filtrados.forEach(p => {
        const fila = document.createElement('tr');
        const estadoBadge = p.saldoPendiente <= 0 ? `<span style="background:rgba(129,199,132,0.2); color:#81c784; padding:2px 8px; border-radius:4px; font-weight:bold;">SOLVENTE</span>` : `<span style="background:rgba(239,83,80,0.2); color:#ef5350; padding:2px 8px; border-radius:4px; font-weight:bold;">PENDIENTE</span>`;
        let desgloseHTML = '<small style="color:#aaa;">Sin especificación</small>';
        if (p.itemsPendientes && Array.isArray(p.itemsPendientes) && p.itemsPendientes.length > 0) {
            const itemsList = p.itemsPendientes.map(it => `· ${it.nombre || it} (${it.monto ? formatearQ(it.monto) : ''})`).join('<br>');
            desgloseHTML = `<details style="cursor:pointer;"><summary style="color:var(--accent-color); font-weight:bold; outline:none;">🔍 Ver Detalle ▾</summary><div style="margin-top:6px; padding:6px; background:rgba(0,0,0,0.4); border-radius:6px; font-size:0.78rem;">${itemsList}</div></details>`;
        }
        fila.innerHTML = `
            <td><strong>${p.cliente.toUpperCase()}</strong></td><td><small>${p.fecha || ''}</small></td><td>${desgloseHTML}</td>
            <td style="text-align: center; font-weight:bold;">${formatearQ(p.montoTotal)}</td><td style="text-align: center; color:#81c784;">${formatearQ(p.montoPagado)}</td>
            <td style="text-align: center; color:#ef5350; font-weight:bold;">${formatearQ(p.saldoPendiente)}</td><td style="text-align: center;">${estadoBadge}</td>
            <td style="text-align: center;">${p.saldoPendiente > 0 ? `<button onclick="abrirModalAbono('${p.id}', '${p.cliente}', ${p.saldoPendiente})" style="background:#2e7d32; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">💵 Abonar</button>` : ''}</td>
        `;
        tablaPagos.appendChild(fila);
    });
}

document.getElementById('buscador-pagos').addEventListener('input', renderizarPagos);

window.abrirModalAbono = (id, cliente, saldo) => {
    document.getElementById('abono-pago-id').value = id;
    document.getElementById('abono-cliente-nombre').textContent = `Clienta: ${cliente.toUpperCase()} | Saldo: ${formatearQ(saldo)}`;
    document.getElementById('abono-monto-ingresado').value = '';
    document.getElementById('modal-abono').style.display = 'flex';
};

window.cerrarModalAbono = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-abono').style.display = 'none'; };

document.getElementById('form-abono').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('abono-pago-id').value;
    const monto = parseFloat(document.getElementById('abono-monto-ingresado').value) || 0;
    const metodo = document.getElementById('abono-metodo').value;
    const pagoDoc = listaPagosCache.find(p => p.id === id);
    if (!pagoDoc || monto <= 0 || monto > pagoDoc.saldoPendiente) { mostrarNotificacion('⚠️ Monto inválido.', 'error'); return; }

    const nuevoPagado = (pagoDoc.montoPagado || 0) + monto;
    const nuevoSaldo = Math.max(0, pagoDoc.montoTotal - nuevoPagado);
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mesAnioStr = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    const historialAbonosAct = pagoDoc.historialAbonos || [];
    historialAbonosAct.push({ fecha: fechaStr, monto, metodo });

    try {
        await updateDoc(doc(db, "pagos_creditos", id), { montoPagado: nuevoPagado, saldoPendiente: nuevoSaldo, estado: nuevoSaldo <= 0 ? 'SOLVENTE' : 'PENDIENTE', historialAbonos: historialAbonosAct });
        if (nuevoSaldo <= 0 && pagoDoc.numRecibo) {
            const snapRecibo = await getDocs(query(recibosRef, where("numRecibo", "==", pagoDoc.numRecibo)));
            snapRecibo.forEach(async docRec => await updateDoc(doc(db, "recibos_historial", docRec.id), { saldoPendiente: 0, estadoPago: 'PAGADO' }));
        }
        const abonoTransaccion = { numRecibo: pagoDoc.numRecibo || 'ABONO', tipo: 'ABONO DEUDA', concepto: `ABONO A DEUDA (${pagoDoc.numRecibo || 'CRÉDITO'})`, cliente: pagoDoc.cliente, estilista: 'SISTEMA', monto, metodo, fecha: fechaStr, mesAnio: mesAnioStr, timestamp: ahora.getTime() };
        await addDoc(ventasRef, abonoTransaccion);
        await addDoc(permanenteRef, abonoTransaccion);
        cerrarModalAbono();
        mostrarNotificacion(`💵 Abono de ${formatearQ(monto)} registrado.`, 'exito');
    } catch (err) { mostrarNotificacion('❌ Error al registrar abono.', 'error'); }
});

onSnapshot(recibosRef, (snapshot) => {
    listaRecibosCache = [];
    snapshot.forEach(docSnap => listaRecibosCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaRecibosCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderizarRecibosHistorial();
});

function renderizarRecibosHistorial() {
    tablaRecibosHistorial.innerHTML = '';
    const texto = document.getElementById('buscador-recibos').value.toLowerCase().trim();
    const filtrados = listaRecibosCache.filter(r => !texto || (r.cliente || '').toLowerCase().includes(texto) || (r.numRecibo || '').toLowerCase().includes(texto));
    if (filtrados.length === 0) { tablaRecibosHistorial.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888;">No hay comprobantes guardados.</td></tr>`; return; }

    filtrados.forEach(rec => {
        const fila = document.createElement('tr');
        const resumenItems = (rec.items || []).map(i => `${i.nombre} (${i.cantidad})`).join(', ');
        const estadoBadge = rec.saldoPendiente > 0 ? `<span style="background:rgba(239,83,80,0.2); color:#ef5350; padding:2px 8px; border-radius:4px; font-size:11px;">DEUDA: ${formatearQ(rec.saldoPendiente)}</span>` : `<span style="background:rgba(129,199,132,0.2); color:#81c784; padding:2px 8px; border-radius:4px; font-size:11px;">PAGADO</span>`;
        fila.innerHTML = `
            <td><strong style="color: var(--accent-color);">${rec.numRecibo || 'S/N'}</strong></td><td><small>${rec.fecha || ''}</small></td>
            <td><strong>${(rec.cliente || '').toUpperCase()}</strong></td><td><small style="color: var(--text-muted);">${resumenItems}</small></td>
            <td style="text-align: center;"><small>${rec.metodo || 'Efectivo'}</small></td><td style="text-align: center; font-weight: bold; color: #81c784;">${formatearQ(rec.total)}</td>
            <td style="text-align: center;">${estadoBadge}</td>
            <td style="text-align: center;"><div style="display: flex; gap: 4px; justify-content: center;"><button onclick="verDetalleRecibo('${rec.id}')" style="background:#1976D2; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px;">👁️ Ver / PDF</button><button onclick="reeditarReciboPOS('${rec.id}')" style="background:#ff9800; color:black; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">✏️ Editar</button></div></td>
        `;
        tablaRecibosHistorial.appendChild(fila);
    });
}

document.getElementById('buscador-recibos').addEventListener('input', renderizarRecibosHistorial);

window.verDetalleRecibo = (idRecibo) => {
    const rec = listaRecibosCache.find(r => r.id === idRecibo);
    if (!rec) return;
    document.getElementById('ver-recibo-titulo').textContent = `Comprobante ${rec.numRecibo}`;
    document.getElementById('ver-recibo-sub').textContent = `Clienta: ${rec.cliente.toUpperCase()} | Método: ${rec.metodo || 'Efectivo'} | Fecha: ${rec.fecha}`;
    const tablaItems = document.getElementById('ver-recibo-items');
    tablaItems.innerHTML = '';
    (rec.items || []).forEach(item => {
        tablaItems.innerHTML += `<tr><td><small>${item.tipo}</small></td><td><strong>${item.nombre}</strong></td><td>${item.estilista || 'N/A'}</td><td style="text-align: center;">${formatearQ(item.subtotal)}</td></tr>`;
    });
    document.getElementById('ver-recibo-total').textContent = formatearQ(rec.total);
    document.getElementById('btn-reimprimir-recibo').onclick = () => generarPDFReciboIndividual(rec);
    document.getElementById('modal-ver-recibo').style.display = 'flex';
};

window.cerrarModalVerRecibo = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-ver-recibo').style.display = 'none'; };

window.reeditarReciboPOS = (idRecibo) => {
    const rec = listaRecibosCache.find(r => r.id === idRecibo);
    if (!rec) return;
    ticketPOSActual = { idReciboExistente: rec.id, items: JSON.parse(JSON.stringify(rec.items || [])) };
    document.getElementById('pos-cliente').value = rec.cliente;
    document.getElementById('pos-metodo-pago').value = rec.metodo || 'Efectivo';
    renderizarTicketPOS();
    navegarA('ficha');
    mostrarNotificacion(`✏️ Comprobante ${rec.numRecibo} cargado para editar.`, 'exito');
};

function generarPDFReciboIndividual(recibo) {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) return;
    const docPdf = new jsPDFLib();
    docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(18); docPdf.text("D'MAR STYLE SALÓN", 105, 18, { align: 'center' });
    docPdf.setFontSize(12); docPdf.setFont('helvetica', 'normal'); docPdf.text(`Comprobante No: ${recibo.numRecibo} | Fecha: ${recibo.fecha}`, 105, 25, { align: 'center' });
    docPdf.line(14, 29, 196, 29);
    docPdf.setFont('helvetica', 'bold'); docPdf.text(`CLIENTA: ${recibo.cliente.toUpperCase()}`, 14, 37);

    const filas = (recibo.items || []).map(i => [i.tipo, i.nombre, i.estilista || 'N/A', i.cantidad, formatearQ(i.precioUnitario), formatearQ(i.subtotal)]);
    docPdf.autoTable({ startY: 42, head: [['Tipo', 'Concepto', 'Estilista', 'Cant.', 'Precio', 'Subtotal']], body: filas, theme: 'striped' });
    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFontSize(12); docPdf.text(`SUMA GENERAL: ${formatearQ(recibo.total)}`, 14, finalY);
    if (recibo.saldoPendiente > 0) docPdf.text(`SALDO PENDIENTE: ${formatearQ(recibo.saldoPendiente)}`, 14, finalY + 6);
    docPdf.save(`Comprobante_${recibo.numRecibo}_DMar.pdf`);
}

onSnapshot(productosRef, (snapshot) => {
    listaProductosCache = [];
    snapshot.forEach(docSnap => listaProductosCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaProductosCache.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));
    renderizarProductos(listaProductosCache);
});

function renderizarProductos(productos) {
    tablaProductos.innerHTML = '';
    const textoBuscador = document.getElementById('buscador-productos') ? document.getElementById('buscador-productos').value.toLowerCase().trim() : '';
    const filtrados = productos.filter(p => !textoBuscador || `${p.nombre || ''} ${p.codigo || ''}`.toLowerCase().includes(textoBuscador));
    const panelAlertas = document.getElementById('panel-alertas'), listaAlertas = document.getElementById('lista-alertas');
    if (panelAlertas && listaAlertas) {
        const agotar = productos.filter(p => parseInt(p.stock) <= 0);
        if (agotar.length > 0) {
            panelAlertas.style.display = 'block';
            listaAlertas.innerHTML = agotar.map(p => `• <strong>${p.nombre}</strong> (Stock agotado)`).join('<br>');
        } else { panelAlertas.style.display = 'none'; }
    }
    if (filtrados.length === 0) { tablaProductos.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">No hay productos.</td></tr>`; return; }
    filtrados.forEach(prod => {
        tablaProductos.innerHTML += `<tr><td><strong>${prod.codigo}</strong></td><td>${prod.nombre}</td><td style="text-align: center;">${formatearQ(prod.precio)}</td><td style="text-align: center;">${prod.stock}</td><td style="text-align: center;"><button onclick="abrirModalEdicion('${prod.id}', '${prod.codigo}', '${prod.nombre}', ${prod.precio}, ${prod.stock})" style="background:#555; color:white; border:none; padding:4px 8px; border-radius:4px;">Editar</button></td></tr>`;
    });
}

if (document.getElementById('buscador-productos')) document.getElementById('buscador-productos').addEventListener('input', () => renderizarProductos(listaProductosCache));

document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(productosRef, { codigo: document.getElementById('codigo-prod').value.trim().toUpperCase(), nombre: document.getElementById('nombre-prod').value.trim().toUpperCase(), precio: parseFloat(document.getElementById('precio-prod').value) || 0, stock: parseInt(document.getElementById('stock-prod').value) || 0, fechaCreacion: new Date() });
        document.getElementById('form-producto').reset();
        mostrarNotificacion('📦 Producto guardado.', 'exito');
    } catch (error) { mostrarNotificacion('❌ Error al guardar.', 'error'); }
});

onSnapshot(serviciosRef, (snapshot) => {
    listaServiciosCache = [];
    snapshot.forEach(docSnap => listaServiciosCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaServiciosCache.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    renderizarServicios(listaServiciosCache);
});

function renderizarServicios(servicios) {
    tablaServicios.innerHTML = '';
    const textoBuscador = document.getElementById('buscador-servicios') ? document.getElementById('buscador-servicios').value.toLowerCase().trim() : '';
    const filtrados = servicios.filter(s => !textoBuscador || (s.nombre || '').toLowerCase().includes(textoBuscador));
    if (filtrados.length === 0) { tablaServicios.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">No hay servicios.</td></tr>`; return; }
    filtrados.forEach(s => {
        tablaServicios.innerHTML += `<tr><td><strong>${s.nombre}</strong></td><td style="text-align: center;">${formatearQ(s.precio)}</td><td style="text-align: center;"><button onclick="abrirModalEdicionServicio('${s.id}', '${s.nombre}', ${s.precio})" style="background:#555; color:white; border:none; padding:4px 8px; border-radius:4px;">Editar</button></td></tr>`;
    });
}

if (document.getElementById('buscador-servicios')) document.getElementById('buscador-servicios').addEventListener('input', () => renderizarServicios(listaServiciosCache));

document.getElementById('form-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(serviciosRef, { nombre: document.getElementById('nombre-serv').value.trim().toUpperCase(), precio: parseFloat(document.getElementById('precio-serv').value) || 0, fechaCreacion: new Date() });
        document.getElementById('form-servicio').reset();
        mostrarNotificacion('✨ Servicio guardado.', 'exito');
    } catch (error) { mostrarNotificacion('❌ Error al guardar servicio.', 'error'); }
});

onSnapshot(comisionesRef, (snapshot) => {
    listaComisionesCache = [];
    snapshot.forEach(docSnap => listaComisionesCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaComisionesCache.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderizarControlEstilistas();
});

function renderizarControlEstilistas() {
    const contenedorResumen = document.getElementById('contenedor-resumen-estilistas');
    const tablaDetalles = document.getElementById('tabla-estilistas-detalles');
    let totalServiciosQ = 0, totalComisionQ = 0, totalConteo = 0;
    const mapaEstilistas = {};

    listaComisionesCache.forEach(s => {
        const estNombre = (s.estilista || 'DESCONOCIDO').toUpperCase();
        const precioServ = parseFloat(s.precioTotal || s.monto || 0);
        const comision = precioServ * 0.30;
        if (!mapaEstilistas[estNombre]) mapaEstilistas[estNombre] = { nombre: estNombre, totalGenerado: 0, totalComision: 0, conteo: 0, trabajos: [] };
        mapaEstilistas[estNombre].totalGenerado += precioServ;
        mapaEstilistas[estNombre].totalComision += comision;
        mapaEstilistas[estNombre].conteo += 1;
        mapaEstilistas[estNombre].trabajos.push(s);
        totalServiciosQ += precioServ; totalComisionQ += comision; totalConteo += 1;
    });

    document.getElementById('stat-estilistas-total-servicios').textContent = formatearQ(totalServiciosQ);
    document.getElementById('stat-estilistas-total-comision').textContent = formatearQ(totalComisionQ);
    document.getElementById('stat-estilistas-conteo').textContent = totalConteo;
    contenedorResumen.innerHTML = ''; tablaDetalles.innerHTML = '';

    const lista = Object.values(mapaEstilistas);
    if (lista.length === 0) { contenedorResumen.innerHTML = `<p style="text-align: center; color: #888;">No hay comisiones.</p>`; return; }

    const grid = document.createElement('div');
    grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;`;
    lista.forEach(est => {
        grid.innerHTML += `<div style="background: rgba(255,152,0,0.05); border: 1px solid var(--border-color); border-radius: 10px; padding: 15px;"><h3 style="color: var(--accent-color); font-size: 1.1rem;">✂️ ${est.nombre}</h3><p style="font-size: 0.85rem; color: var(--text-muted);">Servicios: <strong>${est.conteo}</strong> | Total: <strong>${formatearQ(est.totalGenerado)}</strong></p><p style="font-size: 0.95rem; color: #ffb74d; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px; margin-top: 5px;">Comisión (30%): ${formatearQ(est.totalComision)}</p></div>`;
        est.trabajos.forEach(t => {
            const precioS = parseFloat(t.precioTotal || t.monto || 0);
            tablaDetalles.innerHTML += `<tr><td><small>${t.fecha}</small></td><td><strong>${est.nombre}</strong></td><td>${(t.concepto || '').replace('SERVICIO: ', '')}</td><td>${t.cliente.toUpperCase()}</td><td style="text-align: center;">${formatearQ(precioS)}</td><td style="text-align: center; color: #ffb74d;">${formatearQ(precioS * 0.30)}</td></tr>`;
        });
    });
    contenedorResumen.appendChild(grid);
}

window.procesarCierreMensualComisiones = () => {
    if (listaComisionesCache.length === 0) { mostrarNotificacion('⚠️ No hay comisiones para cerrar.', 'error'); return; }
    confirmarAccion('¿Confirma Cierre Mensual de Comisiones?', async () => {
        generarPDFComisionesEstilistas();
        for (const docCom of listaComisionesCache) await deleteDoc(doc(db, "comisiones_estilistas", docCom.id));
        mostrarNotificacion('🔒 Cierre de comisiones completado.', 'exito');
    });
};

function generarPDFComisionesEstilistas() {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) return;
    const docPdf = new jsPDFLib();
    const hoy = new Date().toLocaleDateString();
    docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(18); docPdf.text("D'MAR STYLE SALÓN", 105, 18, { align: 'center' });
    docPdf.setFontSize(12); docPdf.setFont('helvetica', 'normal'); docPdf.text(`Liquidación de Comisiones (30%) - ${hoy}`, 105, 25, { align: 'center' });
    docPdf.line(14, 29, 196, 29);
    const filas = listaComisionesCache.map(t => { const p = parseFloat(t.precioTotal || t.monto || 0); return [t.fecha || '', (t.estilista || '').toUpperCase(), (t.concepto || '').replace('SERVICIO: ', ''), (t.cliente || '').toUpperCase(), formatearQ(p), formatearQ(p * 0.30)]; });
    docPdf.autoTable({ startY: 34, head: [['Fecha', 'Estilista', 'Servicio', 'Cliente', 'Precio Total', 'Comisión 30%']], body: filas, theme: 'striped' });
    docPdf.save(`Comisiones_${hoy.replace(/\//g, '-')}.pdf`);
}

onSnapshot(permanenteRef, (snapshot) => {
    listaPermanenteCache = [];
    snapshot.forEach(docSnap => listaPermanenteCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaPermanenteCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderizarHistorialPermanente();
    renderizarTablaCorrecciones();
});

function renderizarHistorialPermanente() {
    if (!contenedorPermanente) return;
    contenedorPermanente.innerHTML = '';
    const texto = document.getElementById('buscador-permanente') ? document.getElementById('buscador-permanente').value.toLowerCase().trim() : '';
    const filtrados = listaPermanenteCache.filter(r => !texto || `${r.concepto || ''} ${r.cliente || ''} ${r.estilista || ''} ${r.fecha || ''}`.toLowerCase().includes(texto));
    if (filtrados.length === 0) { contenedorPermanente.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">No hay registros.</p>`; return; }

    let html = `<div class="table-responsive"><table><thead><tr><th>Fecha y Hora</th><th>Tipo</th><th>Concepto</th><th>Clienta</th><th>Estilista</th><th style="text-align: center;">Monto</th><th style="text-align: center;">Método</th></tr></thead><tbody>`;
    filtrados.forEach(reg => {
        const esGasto = reg.tipo === 'GASTO';
        html += `<tr><td><small>${reg.fecha || ''}</small></td><td><span style="font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:4px; background:${esGasto ? 'rgba(239,83,80,0.2)' : 'rgba(129,199,132,0.2)'}; color:${esGasto ? '#ef5350' : '#81c784'};">${reg.tipo || 'INGRESO'}</span></td><td><strong>${(reg.concepto || '').toUpperCase()}</strong></td><td>${(reg.cliente || '').toUpperCase()}</td><td>${(reg.estilista || '').toUpperCase()}</td><td style="text-align: center; font-weight: bold; color:${esGasto ? '#ef5350' : '#81c784'};">${esGasto ? '-' : ''}${formatearQ(reg.monto)}</td><td style="text-align: center;"><small>${reg.metodo || 'Efectivo'}</small></td></tr>`;
    });
    html += `</tbody></table></div>`;
    contenedorPermanente.innerHTML = html;
}

if (document.getElementById('buscador-permanente')) document.getElementById('buscador-permanente').addEventListener('input', renderizarHistorialPermanente);

window.generarPDFCierreMensualPermanente = () => {
    const selectMes = document.getElementById('select-mes-permanente');
    if (!selectMes || !selectMes.value) return;
    const mesSeleccionado = selectMes.value.toUpperCase().trim();
    let registrosMes = listaPermanenteCache.filter(r => (r.mesAnio || '').toUpperCase().includes(mesSeleccionado) || (r.fecha || '').toUpperCase().includes(mesSeleccionado));
    if (registrosMes.length === 0 && listaPermanenteCache.length > 0) registrosMes = listaPermanenteCache;
    if (registrosMes.length === 0) { mostrarNotificacion('⚠️ No hay registros.', 'error'); return; }

    confirmarAccion(`¿Generar reporte PDF de ${mesSeleccionado}?`, () => {
        const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        if (!jsPDFLib) return;
        const docPdf = new jsPDFLib();
        let totalIngresosBrutos = 0, totalServicios = 0, totalProductos = 0, totalGastos = 0, totalComisionesEstilistas = 0;

        const filas = registrosMes.map(r => {
            const montoVal = parseFloat(r.monto) || 0;
            const tipoReg = (r.tipo || '').toUpperCase();
            const conceptoReg = (r.concepto || '').toUpperCase();
            if (tipoReg === 'GASTO') { totalGastos += montoVal; }
            else {
                totalIngresosBrutos += montoVal;
                if (tipoReg === 'SERVICIO' || conceptoReg.includes('SERVICIO')) { totalServicios += montoVal; totalComisionesEstilistas += (montoVal * 0.30); }
                else if (!conceptoReg.includes('ABONO')) { totalProductos += montoVal; }
            }
            return [r.fecha || '', r.tipo || 'INGRESO', conceptoReg, (r.cliente || '').toUpperCase(), (r.estilista || '').toUpperCase(), r.metodo || 'Efectivo', `${tipoReg === 'GASTO' ? '-' : ''}${formatearQ(montoVal)}`];
        });

        const creditosMes = listaPagosCache.filter(p => (p.mesAnio || '').toUpperCase().includes(mesSeleccionado) && (parseFloat(p.saldoPendiente) || 0) > 0);
        const filasCuentasCobrar = creditosMes.map(c => [(c.cliente || '').toUpperCase(), c.numRecibo || 'N/A', c.fecha || '', formatearQ(c.montoTotal), formatearQ(c.saldoPendiente)]);
        const balanceNetoFinal = totalIngresosBrutos - totalGastos - totalComisionesEstilistas;

        docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(18); docPdf.text("D'MAR STYLE SALÓN", 105, 18, { align: 'center' });
        docPdf.setFontSize(12); docPdf.setFont('helvetica', 'normal'); docPdf.text(`Cierre y Desglose Financiero - ${mesSeleccionado}`, 105, 25, { align: 'center' });
        docPdf.line(14, 29, 196, 29);

        docPdf.autoTable({ startY: 34, head: [['Fecha', 'Tipo', 'Concepto', 'Clienta', 'Estilista', 'Método', 'Monto']], body: filas, theme: 'striped', headStyles: { fillColor: [100, 50, 150] } });
        let finalY = docPdf.lastAutoTable.finalY + 10;
        if (finalY > 210) { docPdf.addPage(); finalY = 20; }

        docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(11); docPdf.text(`RESUMEN Y ESTADÍSTICAS (${mesSeleccionado}):`, 14, finalY);
        docPdf.setFont('helvetica', 'normal'); docPdf.setFontSize(10);
        docPdf.text(`· Ingresos por Servicios: ${formatearQ(totalServicios)}`, 14, finalY + 6);
        docPdf.text(`· Ingresos por Productos: ${formatearQ(totalProductos)}`, 14, finalY + 12);
        docPdf.text(`· Ingresos Brutos Totales: ${formatearQ(totalIngresosBrutos)}`, 14, finalY + 18);
        docPdf.text(`· Comisiones Estilistas (30%): ${formatearQ(totalComisionesEstilistas)}`, 14, finalY + 24);
        docPdf.text(`· Total Gastos / Salidas: ${formatearQ(totalGastos)}`, 14, finalY + 30);
        docPdf.setFont('helvetica', 'bold'); docPdf.text(`· BALANCE NETO FINAL: ${formatearQ(balanceNetoFinal)}`, 14, finalY + 38);

        if (filasCuentasCobrar.length > 0) {
            let nextY = finalY + 48;
            if (nextY > 230) { docPdf.addPage(); nextY = 20; }
            docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(11); docPdf.text("CUENTAS POR COBRAR (Saldos Pendientes):", 14, nextY);
            docPdf.autoTable({ startY: nextY + 4, head: [['Clienta', 'No. Recibo', 'Fecha', 'Monto Total', 'Saldo Pendiente']], body: filasCuentasCobrar, theme: 'grid', headStyles: { fillColor: [180, 50, 50] } });
        }

        docPdf.save(`Cierre_${mesSeleccionado.replace(/\s+/g, '_')}_DMar.pdf`);
        mostrarNotificacion('✨ PDF generado correctamente.', 'exito');
    });
};

function renderizarTablaCorrecciones() {
    if (!tablaCorrecciones) return;
    tablaCorrecciones.innerHTML = '';
    const texto = document.getElementById('buscador-correcciones') ? document.getElementById('buscador-correcciones').value.toLowerCase().trim() : '';
    const filtrados = listaPermanenteCache.filter(r => !texto || `${r.concepto || ''} ${r.cliente || ''}`.toLowerCase().includes(texto));
    filtrados.forEach(reg => {
        tablaCorrecciones.innerHTML += `<tr><td><small>${reg.fecha || ''}</small></td><td><small>${reg.tipo || ''}</small></td><td><strong>${(reg.concepto || '').toUpperCase()}</strong></td><td>${(reg.cliente || '').toUpperCase()}</td><td style="text-align: center;">${formatearQ(reg.monto)}</td><td style="text-align: center;"><button onclick="anularRegistroPorError('${reg.id}', '${reg.concepto.replace(/'/g, "\\'")}', '${reg.tipo}', ${reg.productoId ? `'${reg.productoId}'` : 'null'}, ${reg.cantidadVendida || 1}, ${reg.timestamp || 0}, ${reg.numRecibo ? `'${reg.numRecibo}'` : 'null'})" style="background-color: #c62828; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️ Anular</button></td></tr>`;
    });
}

window.anularRegistroPorError = (idPermanente, concepto, tipo, productoId, cantidadVendida, timestamp, numRecibo) => {
    confirmarAccion(`¿Confirma anular "${concepto}"?`, async () => {
        try {
            await deleteDoc(doc(db, "historial_permanente", idPermanente));
            if (timestamp) {
                const snapDiario = await getDocs(query(ventasRef, where("timestamp", "==", timestamp)));
                snapDiario.forEach(async d => await deleteDoc(doc(db, "ventas_historial", d.id)));
                const snapCom = await getDocs(query(comisionesRef, where("timestamp", "==", timestamp)));
                snapCom.forEach(async d => await deleteDoc(doc(db, "comisiones_estilistas", d.id)));
                const snapPagos = await getDocs(query(pagosRef, where("timestamp", "==", timestamp)));
                snapPagos.forEach(async d => await deleteDoc(doc(db, "pagos_creditos", d.id)));
            }
            if (numRecibo) {
                const snapRec = await getDocs(query(recibosRef, where("numRecibo", "==", numRecibo)));
                snapRec.forEach(async d => await deleteDoc(doc(db, "recibos_historial", d.id)));
            }
            if (tipo === 'INGRESO' && productoId) {
                const docProd = listaProductosCache.find(p => p.id === productoId);
                if (docProd) await updateDoc(doc(db, "productos", productoId), { stock: (docProd.stock || 0) + cantidadVendida });
            }
            mostrarNotificacion('🗑️ Registro anulado correctamente.', 'exito');
        } catch (error) { mostrarNotificacion('❌ Error al anular.', 'error'); }
    });
};

onSnapshot(ventasRef, (snapshot) => {
    listaVentasCache = [];
    snapshot.forEach(docSnap => listaVentasCache.push({ id: docSnap.id, ...docSnap.data() }));
    listaVentasCache.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderizarVentas(listaVentasCache);
});

function renderizarVentas(ventas) {
    tablaVentasHistorial.innerHTML = '';
    let totalIngresos = 0, totalEfectivo = 0, totalDigital = 0, totalGastos = 0;
    ventas.forEach(v => {
        const montoVal = parseFloat(v.monto) || 0;
        if (v.tipo === 'GASTO') totalGastos += montoVal;
        else { totalIngresos += montoVal; if (v.metodo === 'Efectivo') totalEfectivo += montoVal; else totalDigital += montoVal; }
        tablaVentasHistorial.innerHTML += `<tr><td><small>${v.fecha || ''}</small></td><td><strong>${(v.concepto || '').toUpperCase()}</strong></td><td>${(v.cliente || '').toUpperCase()}</td><td><strong style="color: ${v.tipo === 'GASTO' ? '#ef5350' : '#4CAF50'};">${v.tipo === 'GASTO' ? '-' : ''}${formatearQ(montoVal)}</strong></td><td><small>${v.metodo || 'Efectivo'}</small></td></tr>`;
    });
    document.getElementById('stat-total-ventas').textContent = formatearQ(totalIngresos);
    document.getElementById('stat-efectivo').textContent = formatearQ(Math.max(0, totalEfectivo - totalGastos));
    document.getElementById('stat-digital').textContent = formatearQ(totalDigital);
    document.getElementById('stat-gastos').textContent = formatearQ(totalGastos);
}

window.procesarCierreCaja = () => {
    if (listaVentasCache.length === 0) { mostrarNotificacion('⚠️ No hay movimientos.', 'error'); return; }
    confirmarAccion('¿Confirma Cierre Diario de Caja?', async () => {
        generarPDFCierreCajaDiario();
        for (const v of listaVentasCache) await deleteDoc(doc(db, "ventas_historial", v.id));
        mostrarNotificacion('🔒 Cierre diario completado.', 'exito');
    });
};

function generarPDFCierreCajaDiario() {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) return;
    const docPdf = new jsPDFLib();
    const hoy = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let totalIngresos = 0, totalEfectivo = 0, totalDigital = 0, totalGastos = 0;
    const filas = listaVentasCache.map(v => {
        const montoVal = parseFloat(v.monto) || 0;
        if (v.tipo === 'GASTO') totalGastos += montoVal;
        else { totalIngresos += montoVal; if (v.metodo === 'Efectivo') totalEfectivo += montoVal; else totalDigital += montoVal; }
        return [v.fecha || '', (v.concepto || '').toUpperCase(), (v.cliente || '').toUpperCase(), v.metodo || 'Efectivo', `${v.tipo === 'GASTO' ? '-' : ''}${formatearQ(montoVal)}`];
    });
    const netoEfectivo = Math.max(0, totalEfectivo - totalGastos);
    docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(18); docPdf.text("D'MAR STYLE SALÓN", 105, 18, { align: 'center' });
    docPdf.setFontSize(12); docPdf.setFont('helvetica', 'normal'); docPdf.text(`Cierre de Caja Diario - ${hoy}`, 105, 25, { align: 'center' });
    docPdf.line(14, 29, 196, 29);
    docPdf.autoTable({ startY: 34, head: [['Fecha y Hora', 'Concepto', 'Cliente', 'Método', 'Monto']], body: filas, theme: 'striped', headStyles: { fillColor: [46, 125, 50] } });
    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFont('helvetica', 'bold'); docPdf.setFontSize(11); docPdf.text("RESUMEN DE CAJA:", 14, finalY);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`· Ingreso Bruto: ${formatearQ(totalIngresos)}`, 14, finalY + 6);
    docPdf.text(`· Pagos Digitales: ${formatearQ(totalDigital)}`, 14, finalY + 12);
    docPdf.text(`· Gastos de Caja: ${formatearQ(totalGastos)}`, 14, finalY + 18);
    docPdf.setFont('helvetica', 'bold'); docPdf.text(`· EFECTIVO NETO: ${formatearQ(netoEfectivo)}`, 14, finalY + 26);
    docPdf.save(`Cierre_Caja_${new Date().toISOString().slice(0, 10)}.pdf`);
}

window.abrirModalGasto = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    const modal = document.getElementById('modal-gasto');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalGasto = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-gasto').style.display = 'none'; };

const formGastoElem = document.getElementById('form-gasto');
if (formGastoElem) {
    formGastoElem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const concepto = document.getElementById('gasto-concepto').value.trim().toUpperCase();
        const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
        const origen = document.getElementById('gasto-origen').value;
        if (monto <= 0) { mostrarNotificacion('⚠️ Monto inválido.', 'error'); return; }
        const ahora = new Date();
        const gastoData = { tipo: 'GASTO', concepto: `GASTO: ${concepto}`, cliente: 'SISTEMA', monto, metodo: origen, fecha: ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mesAnio: ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(), timestamp: ahora.getTime() };
        try {
            await addDoc(ventasRef, gastoData);
            await addDoc(permanenteRef, gastoData);
            cerrarModalGasto();
            mostrarNotificacion(`💸 Gasto de ${formatearQ(monto)} registrado.`, 'exito');
        } catch (error) { mostrarNotificacion('❌ Error al registrar gasto.', 'error'); }
    });
}

window.abrirModalEdicion = (id, codigo, nombre, precio, stock) => {
    document.getElementById('edit-id').value = id; document.getElementById('edit-codigo').value = codigo;
    document.getElementById('edit-nombre').value = nombre; document.getElementById('edit-precio').value = precio;
    document.getElementById('edit-stock').value = stock; document.getElementById('modal-edicion').style.display = 'flex';
};
window.cerrarModalEdicion = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-edicion').style.display = 'none'; };

document.getElementById('form-editar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    await updateDoc(doc(db, "productos", id), { codigo: document.getElementById('edit-codigo').value.toUpperCase(), nombre: document.getElementById('edit-nombre').value.toUpperCase(), precio: parseFloat(document.getElementById('edit-precio').value) || 0, stock: parseInt(document.getElementById('edit-stock').value) || 0 });
    cerrarModalEdicion();
    mostrarNotificacion('✏️ Producto actualizado.', 'exito');
});

window.abrirModalEdicionServicio = (id, nombre, precio) => {
    document.getElementById('edit-serv-id').value = id; document.getElementById('edit-serv-nombre').value = nombre;
    document.getElementById('edit-serv-precio').value = precio; document.getElementById('modal-edicion-servicio').style.display = 'flex';
};
window.cerrarModalEdicionServicio = (e) => { if (e && e.preventDefault) e.preventDefault(); document.getElementById('modal-edicion-servicio').style.display = 'none'; };

document.getElementById('form-editar-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-serv-id').value;
    await updateDoc(doc(db, "servicios", id), { nombre: document.getElementById('edit-serv-nombre').value.toUpperCase(), precio: parseFloat(document.getElementById('edit-serv-precio').value) || 0 });
    cerrarModalEdicionServicio();
    mostrarNotificacion('✏️ Servicio actualizado.', 'exito');
});