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

// COLECCIONES
const productosRef = collection(db, "productos");
const serviciosRef = collection(db, "servicios");
const pagosRef = collection(db, "pagos_creditos");
const ventasRef = collection(db, "ventas_historial");
const permanenteRef = collection(db, "historial_permanente");
const comisionesRef = collection(db, "comisiones_estilistas");
const recibosRef = collection(db, "recibos_historial");

// FUNCIÓN AUXILIAR FORMATO DE MILES (Q1,250.00)
function formatearQ(monto) {
    const val = parseFloat(monto) || 0;
    return 'Q' + val.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// CACHÉ Y ESTADO FICHA
let listaProductosCache = [];
let listaServiciosCache = [];
let listaPagosCache = [];
let listaVentasCache = [];
let listaPermanenteCache = [];
let listaComisionesCache = [];
let listaRecibosCache = [];

let ticketPOSActual = {
    idReciboExistente: null,
    items: []
};

// ELEMENTOS DOM
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

    const limpiar = () => {
        modal.style.display = 'none';
        btnOk.onclick = null;
        btnCancel.onclick = null;
    };

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

window.cerrarModalChangelog = () => {
    document.getElementById('modal-changelog').style.display = 'none';
};

// TOGGLE Y CONTROL DINÁMICO DE PAGO Y DEUDA EN TIEMPO REAL
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
        if (chk && chk.checked) {
            sumaPendiente += item.subtotal;
        }
    });

    const abonoSugerido = Math.max(0, totalTicket - sumaPendiente);
    document.getElementById('pos-monto-abono').value = abonoSugerido > 0 ? abonoSugerido.toFixed(2) : '';
    actualizarSumaDinamicaPOS();
};

window.actualizarSumaDinamicaPOS = () => {
    let totalTicket = 0;
    ticketPOSActual.items.forEach(i => totalTicket += i.subtotal);

    const estado = document.getElementById('pos-estado-pago').value;
    let abonoVal = 0;

    if (estado === 'CREDITO') {
        abonoVal = parseFloat(document.getElementById('pos-monto-abono').value) || 0;
    } else {
        abonoVal = totalTicket;
    }

    const saldoDeuda = Math.max(0, totalTicket - abonoVal);

    document.getElementById('pos-total-monto').textContent = formatearQ(totalTicket);
    document.getElementById('pos-cobro-hoy-monto').textContent = formatearQ(abonoVal);
    document.getElementById('pos-deuda-monto').textContent = formatearQ(saldoDeuda);
};

// NAVEGACIÓN Y CAMBIO DINÁMICO DE COLORES
window.navegarA = (seccion) => {
    const secciones = ['ficha', 'recibos', 'inventario', 'servicios', 'estilistas', 'pagos', 'reportes', 'permanente', 'correcciones'];
    const body = document.body;
    const tituloHeader = document.getElementById('header-seccion-titulo');

    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));

    secciones.forEach(s => {
        const secElem = document.getElementById(`seccion-${s}`);
        if (secElem) secElem.style.display = 'none';
    });

    body.className = `theme-${seccion}`;

    const actual = document.getElementById(`seccion-${seccion}`);
    if (actual) actual.style.display = 'block';

    const menuBtn = document.getElementById(`menu-btn-${seccion}`);
    if (menuBtn) menuBtn.classList.add('active');

    const titulos = {
        ficha: "Ficha de Atención de Salón",
        recibos: "Historial de Comprobantes de Salón",
        inventario: "Gestión de Inventario",
        servicios: "Catálogo de Servicios",
        estilistas: "Control de Estilistas (Comisiones 30%)",
        pagos: "Control de Pagos & Créditos",
        reportes: "Historial Diario & Cierre",
        permanente: "Historial Mensual Permanente",
        correcciones: "Anulación & Corrección de Registros"
    };
    tituloHeader.textContent = titulos[seccion] || "D'Mar Beauty House";

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
    toast.style.cssText = `
        background-color: ${tipo === 'exito' ? '#2e7d32' : '#c62828'};
        color: #ffffff; padding: 12px 20px; border-radius: 8px; font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); opacity: 0; transform: translateY(-10px); transition: all 0.3s ease;
    `;

    contenedor.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// BUSCADOR EN SERVICIOS Y PRODUCTOS
window.abrirModalAgregarServicioPOS = () => {
    const datalistServ = document.getElementById('lista-servicios-datalist');
    datalistServ.innerHTML = '';
    listaServiciosCache.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}`;
        datalistServ.appendChild(opt);
    });

    document.getElementById('pos-input-servicio').value = '';
    document.getElementById('pos-item-precio-serv').value = '';

    const estilistaDef = document.getElementById('pos-estilista-defecto').value.trim().toUpperCase();
    document.getElementById('pos-item-estilista').value = estilistaDef;
    document.getElementById('modal-pos-servicio').style.display = 'flex';
};

document.getElementById('pos-input-servicio').addEventListener('input', (e) => {
    const texto = e.target.value.trim().toUpperCase();
    const encontrado = listaServiciosCache.find(s => `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}` === texto || s.nombre.toUpperCase() === texto);
    
    if (encontrado) {
        document.getElementById('pos-item-precio-serv').value = encontrado.precio;
    }
});

window.cerrarModalAgregarServicioPOS = () => { document.getElementById('modal-pos-servicio').style.display = 'none'; };

document.getElementById('form-pos-servicio').addEventListener('submit', (e) => {
    e.preventDefault();
    const textoInput = document.getElementById('pos-input-servicio').value.trim().toUpperCase();
    if (!textoInput) return;

    let servicioSeleccionado = listaServiciosCache.find(s => `${s.nombre.toUpperCase()} - ${formatearQ(s.precio)}` === textoInput || s.nombre.toUpperCase() === textoInput);

    const nombreServ = servicioSeleccionado ? servicioSeleccionado.nombre.toUpperCase() : textoInput.split('-')[0].trim();
    const estilista = document.getElementById('pos-item-estilista').value.trim().toUpperCase() || 'GENERAL';
    
    let precio = parseFloat(document.getElementById('pos-item-precio-serv').value);
    if (isNaN(precio) || precio <= 0) {
        precio = servicioSeleccionado ? parseFloat(servicioSeleccionado.precio) : 0;
    }

    ticketPOSActual.items.push({
        tipo: 'SERVICIO',
        idRef: servicioSeleccionado ? servicioSeleccionado.id : null,
        nombre: nombreServ,
        estilista: estilista,
        cantidad: 1,
        precioUnitario: precio,
        subtotal: precio,
        comision: precio * 0.30
    });

    renderizarTicketPOS();
    cerrarModalAgregarServicioPOS();
});

window.abrirModalAgregarProductoPOS = () => {
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

document.getElementById('pos-input-producto').addEventListener('input', (e) => {
    const texto = e.target.value.trim().toUpperCase();
    const encontrado = listaProductosCache.find(p => `${p.nombre.toUpperCase()} - Stock: ${p.stock} - ${formatearQ(p.precio)}` === texto || p.nombre.toUpperCase() === texto);
    
    if (encontrado) {
        document.getElementById('pos-item-precio-prod').value = encontrado.precio;
    }
});

window.cerrarModalAgregarProductoPOS = () => { document.getElementById('modal-pos-producto').style.display = 'none'; };

document.getElementById('form-pos-producto').addEventListener('submit', (e) => {
    e.preventDefault();
    const textoInput = document.getElementById('pos-input-producto').value.trim().toUpperCase();
    if (!textoInput) return;

    let prodSeleccionado = listaProductosCache.find(p => `${p.nombre.toUpperCase()} - Stock: ${p.stock} - ${formatearQ(p.precio)}` === textoInput || p.nombre.toUpperCase() === textoInput);

    const cant = parseInt(document.getElementById('pos-item-cant-prod').value) || 1;

    if (prodSeleccionado && cant > prodSeleccionado.stock) {
        mostrarNotificacion('⚠️ La cantidad supera el stock disponible.', 'error');
        return;
    }

    const nombreProd = prodSeleccionado ? prodSeleccionado.nombre.toUpperCase() : textoInput.split('-')[0].trim();
    
    let precio = parseFloat(document.getElementById('pos-item-precio-prod').value);
    if (isNaN(precio) || precio <= 0) {
        precio = prodSeleccionado ? parseFloat(prodSeleccionado.precio) : 0;
    }

    ticketPOSActual.items.push({
        tipo: 'PRODUCTO',
        idRef: prodSeleccionado ? prodSeleccionado.id : null,
        nombre: nombreProd,
        estilista: 'N/A',
        cantidad: cant,
        precioUnitario: precio,
        subtotal: precio * cant,
        comision: 0
    });

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

    if (document.getElementById('pos-estado-pago').value === 'CREDITO') {
        toggleCamposAbonoPOS();
    } else {
        actualizarSumaDinamicaPOS();
    }
}

window.quitarItemTicketPOS = (index) => {
    ticketPOSActual.items.splice(index, 1);
    renderizarTicketPOS();
};

window.confirmarYGuardarReciboPOS = async () => {
    if (ticketPOSActual.items.length === 0) {
        mostrarNotificacion('⚠️ La ficha de atención está vacía.', 'error');
        return;
    }

    const clienteIngresado = document.getElementById('pos-cliente').value.trim();
    const cliente = clienteIngresado ? clienteIngresado.toUpperCase() : 'CLIENTE GENERAL';
    const metodoPagoSeleccionado = document.getElementById('pos-metodo-pago').value;
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mesAnioStr = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    const timestampUni = ahora.getTime();

    let totalTicket = 0;
    ticketPOSActual.items.forEach(i => totalTicket += i.subtotal);

    const estadoPago = document.getElementById('pos-estado-pago').value;
    let abonoHoy = 0;
    let itemsPendientesDetalle = [];

    if (estadoPago === 'CREDITO') {
        abonoHoy = parseFloat(document.getElementById('pos-monto-abono').value) || 0;
        if (abonoHoy > totalTicket) {
            mostrarNotificacion('⚠️ El abono no puede superar la suma general de la ficha.', 'error');
            return;
        }

        ticketPOSActual.items.forEach((item, idx) => {
            const chk = document.getElementById(`chk-pendiente-${idx}`);
            if (chk && chk.checked) {
                itemsPendientesDetalle.push({ nombre: item.nombre, monto: item.subtotal });
            }
        });

        if (itemsPendientesDetalle.length === 0) {
            itemsPendientesDetalle = ticketPOSActual.items.map(i => ({ nombre: i.nombre, monto: i.subtotal }));
        }
    } else {
        abonoHoy = totalTicket;
    }

    const numRecibo = 'REC-' + Math.floor(100000 + Math.random() * 900000);
    const saldoPendienteCalc = Math.max(0, totalTicket - abonoHoy);

    const reciboData = {
        numRecibo: numRecibo,
        cliente: cliente,
        metodo: metodoPagoSeleccionado,
        total: totalTicket,
        abonoInicial: abonoHoy,
        saldoPendiente: saldoPendienteCalc,
        estadoPago: estadoPago === 'CREDITO' ? (saldoPendienteCalc <= 0 ? 'PAGADO' : 'PENDIENTE') : 'PAGADO',
        itemsPendientes: itemsPendientesDetalle,
        fecha: fechaStr,
        mesAnio: mesAnioStr,
        timestamp: timestampUni,
        items: ticketPOSActual.items
    };

    try {
        if (ticketPOSActual.idReciboExistente) {
            await deleteDoc(doc(db, "recibos_historial", ticketPOSActual.idReciboExistente));
        }

        await addDoc(recibosRef, reciboData);

        if (saldoPendienteCalc > 0) {
            await addDoc(pagosRef, {
                cliente: cliente,
                numRecibo: numRecibo,
                itemsPendientes: itemsPendientesDetalle,
                montoTotal: totalTicket,
                montoPagado: abonoHoy,
                saldoPendiente: saldoPendienteCalc,
                fecha: fechaStr,
                mesAnio: mesAnioStr,
                timestamp: timestampUni,
                estado: 'PENDIENTE',
                historialAbonos: abonoHoy > 0 ? [{ fecha: fechaStr, monto: abonoHoy, metodo: metodoPagoSeleccionado }] : []
            });
        }

        for (const item of ticketPOSActual.items) {
            const conceptoStr = item.tipo === 'SERVICIO' ? `SERVICIO: ${item.nombre}` : `${item.nombre} (x${item.cantidad})`;
            const montoParaCaja = estadoPago === 'COMPLETO' ? item.subtotal : (totalTicket > 0 ? (item.subtotal / totalTicket) * abonoHoy : 0);

            const transaccion = {
                numRecibo: numRecibo,
                tipo: item.tipo === 'SERVICIO' ? 'SERVICIO' : 'INGRESO',
                concepto: conceptoStr,
                estilista: item.estilista,
                cliente: cliente,
                productoId: item.tipo === 'PRODUCTO' ? item.idRef : null,
                cantidadVendida: item.cantidad,
                monto: montoParaCaja,
                precioTotal: item.subtotal,
                comision: item.comision,
                metodo: metodoPagoSeleccionado,
                fecha: fechaStr,
                mesAnio: mesAnioStr,
                timestamp: timestampUni
            };

            await addDoc(ventasRef, transaccion);
            await addDoc(permanenteRef, transaccion);

            if (item.tipo === 'SERVICIO' && item.estilista) {
                await addDoc(comisionesRef, transaccion);
            }

            if (item.tipo === 'PRODUCTO' && item.idRef) {
                const prodDoc = listaProductosCache.find(p => p.id === item.idRef);
                if (prodDoc) {
                    await updateDoc(doc(db, "productos", item.idRef), { stock: Math.max(0, prodDoc.stock - item.cantidad) });
                }
            }
        }

        ticketPOSActual = { idReciboExistente: null, items: [] };
        document.getElementById('pos-cliente').value = '';
        document.getElementById('pos-estado-pago').value = 'COMPLETO';
        document.getElementById('pos-metodo-pago').value = 'Efectivo';
        toggleCamposAbonoPOS();
        renderizarTicketPOS();

        if (saldoPendienteCalc > 0) {
            mostrarNotificacion(`⚠️ Comprobante ${numRecibo} guardado. Deuda de ${formatearQ(saldoPendienteCalc)} asignada en Cuentas por Cobrar.`, 'exito');
        } else {
            mostrarNotificacion(`✨ Comprobante ${numRecibo} guardado. Total General: ${formatearQ(totalTicket)}`, 'exito');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error al guardar el comprobante.', 'error');
    }
};

// CONTROL DE PAGOS Y DEUDAS
onSnapshot(pagosRef, (snapshot) => {
    listaPagosCache = [];
    snapshot.forEach((docSnapshot) => {
        listaPagosCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    renderizarPagos();
});

function renderizarPagos() {
    tablaPagos.innerHTML = '';
    const texto = document.getElementById('buscador-pagos').value.toLowerCase().trim();

    const filtrados = listaPagosCache.filter(p => !texto || (p.cliente || '').toLowerCase().includes(texto));

    if (filtrados.length === 0) {
        tablaPagos.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888;">No hay saldos pendientes.</td></tr>`;
        return;
    }

    filtrados.forEach((p) => {
        const fila = document.createElement('tr');
        const estadoBadge = p.saldoPendiente <= 0 ? `<span style="background:rgba(129,199,132,0.2); color:#81c784; padding:2px 8px; border-radius:4px; font-weight:bold;">SOLVENTE</span>` : `<span style="background:rgba(239,83,80,0.2); color:#ef5350; padding:2px 8px; border-radius:4px; font-weight:bold;">PENDIENTE</span>`;

        let desgloseHTML = '<small style="color:#aaa;">Sin especificación</small>';
        if (p.itemsPendientes && Array.isArray(p.itemsPendientes) && p.itemsPendientes.length > 0) {
            const itemsList = p.itemsPendientes.map(it => `· ${it.nombre || it} (${it.monto ? formatearQ(it.monto) : ''})`).join('<br>');
            desgloseHTML = `
                <details style="cursor:pointer;">
                    <summary style="color:var(--accent-color); font-weight:bold; outline:none; list-style:none;">
                        🔍 Ver Detalle (${p.itemsPendientes.length}) ▾
                    </summary>
                    <div style="margin-top:6px; padding:6px; background:rgba(0,0,0,0.4); border-radius:6px; font-size:0.78rem; color:#f5f5f7; line-height:1.4;">
                        ${itemsList}
                    </div>
                </details>
            `;
        }

        fila.innerHTML = `
            <td><strong>${p.cliente.toUpperCase()}</strong></td>
            <td><small>${p.fecha || ''}</small></td>
            <td>${desgloseHTML}</td>
            <td style="text-align: center; font-weight:bold;">${formatearQ(p.montoTotal)}</td>
            <td style="text-align: center; color:#81c784;">${formatearQ(p.montoPagado)}</td>
            <td style="text-align: center; color:#ef5350; font-weight:bold;">${formatearQ(p.saldoPendiente)}</td>
            <td style="text-align: center;">${estadoBadge}</td>
            <td style="text-align: center;">
                ${p.saldoPendiente > 0 ? `<button onclick="abrirModalAbono('${p.id}', '${p.cliente}', ${p.saldoPendiente},${p.montoPagado})" style="background:#2e7d32; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">💵 Abonar</button>` : ''}
            </td>
        `;
        tablaPagos.appendChild(fila);
    });
}

document.getElementById('buscador-pagos').addEventListener('input', renderizarPagos);

window.abrirModalAbono = (id, cliente, saldo, pagado) => {
    document.getElementById('abono-pago-id').value = id;
    document.getElementById('abono-cliente-nombre').textContent = `Clienta: ${cliente.toUpperCase()} | Saldo Pendiente: ${formatearQ(saldo)}`;
    document.getElementById('abono-monto-ingresado').value = '';
    document.getElementById('modal-abono').style.display = 'flex';
};

window.cerrarModalAbono = () => { document.getElementById('modal-abono').style.display = 'none'; };

document.getElementById('form-abono').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('abono-pago-id').value;
    const monto = parseFloat(document.getElementById('abono-monto-ingresado').value) || 0;
    const metodo = document.getElementById('abono-metodo').value;

    const pagoDoc = listaPagosCache.find(p => p.id === id);
    if (!pagoDoc) return;

    if (monto <= 0 || monto > pagoDoc.saldoPendiente) {
        mostrarNotificacion('⚠️ El monto del abono debe ser mayor a Q0 y menor al saldo pendiente.', 'error');
        return;
    }

    const nuevoPagado = (pagoDoc.montoPagado || 0) + monto;
    const nuevoSaldo = Math.max(0, pagoDoc.montoTotal - nuevoPagado);
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mesAnioStr = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

    const historialAbonosAct = pagoDoc.historialAbonos || [];
    historialAbonosAct.push({ fecha: fechaStr, monto: monto, metodo: metodo });

    try {
        await updateDoc(doc(db, "pagos_creditos", id), {
            montoPagado: nuevoPagado,
            saldoPendiente: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? 'SOLVENTE' : 'PENDIENTE',
            historialAbonos: historialAbonosAct
        });

        const abonoTransaccion = {
            numRecibo: pagoDoc.numRecibo || 'ABONO',
            tipo: 'ABONO DEUDA',
            concepto: `ABONO A DEUDA (${pagoDoc.numRecibo || 'CRÉDITO'})`,
            cliente: pagoDoc.cliente,
            estilista: 'SISTEMA',
            monto: monto,
            metodo: metodo,
            fecha: fechaStr,
            mesAnio: mesAnioStr,
            timestamp: ahora.getTime()
        };

        await addDoc(ventasRef, abonoTransaccion);
        await addDoc(permanenteRef, abonoTransaccion);

        cerrarModalAbono();
        mostrarNotificacion(`💵 Abono de ${formatearQ(monto)} registrado exitosamente.`, 'exito');
    } catch (err) {
        mostrarNotificacion('❌ Error al registrar el abono.', 'error');
    }
});

// HISTORIAL DE RECIBOS
onSnapshot(recibosRef, (snapshot) => {
    listaRecibosCache = [];
    snapshot.forEach((docSnap) => {
        listaRecibosCache.push({ id: docSnap.id, ...docSnap.data() });
    });

    listaRecibosCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderizarRecibosHistorial();
});

function renderizarRecibosHistorial() {
    tablaRecibosHistorial.innerHTML = '';
    const texto = document.getElementById('buscador-recibos').value.toLowerCase().trim();

    const filtrados = listaRecibosCache.filter(r => {
        if (!texto) return true;
        return (r.cliente || '').toLowerCase().includes(texto) || (r.numRecibo || '').toLowerCase().includes(texto);
    });

    if (filtrados.length === 0) {
        tablaRecibosHistorial.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888;">No hay comprobantes guardados.</td></tr>`;
        return;
    }

    filtrados.forEach(rec => {
        const fila = document.createElement('tr');
        const resumenItems = (rec.items || []).map(i => `${i.nombre} (${i.cantidad})`).join(', ');
        const estadoBadge = rec.saldoPendiente > 0 ? `<span style="background:rgba(239,83,80,0.2); color:#ef5350; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">DEUDA: ${formatearQ(rec.saldoPendiente)}</span>` : `<span style="background:rgba(129,199,132,0.2); color:#81c784; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">PAGADO</span>`;

        fila.innerHTML = `
            <td><strong style="color: var(--accent-color);">${rec.numRecibo || 'S/N'}</strong></td>
            <td><small>${rec.fecha || ''}</small></td>
            <td><strong>${(rec.cliente || 'CLIENTE GENERAL').toUpperCase()}</strong></td>
            <td><small style="color: var(--text-muted);">${resumenItems}</small></td>
            <td style="text-align: center;"><small style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${rec.metodo || 'Efectivo'}</small></td>
            <td style="text-align: center; font-weight: bold; color: #81c784;">${formatearQ(rec.total)}</td>
            <td style="text-align: center;">${estadoBadge}</td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button onclick="verDetalleRecibo('${rec.id}')" style="background:#1976D2; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px;">👁️ Ver / PDF</button>
                    <button onclick="reeditarReciboPOS('${rec.id}')" style="background:#ff9800; color:black; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">✏️ Editar Ficha</button>
                </div>
            </td>
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
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><small>${item.tipo}</small></td>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.estilista || 'N/A'}</td>
            <td style="text-align: center;">${formatearQ(item.subtotal)}</td>
        `;
        tablaItems.appendChild(fila);
    });

    document.getElementById('ver-recibo-total').textContent = formatearQ(rec.total);
    document.getElementById('btn-reimprimir-recibo').onclick = () => generarPDFReciboIndividual(rec);
    document.getElementById('modal-ver-recibo').style.display = 'flex';
};

window.cerrarModalVerRecibo = () => { document.getElementById('modal-ver-recibo').style.display = 'none'; };

window.reeditarReciboPOS = (idRecibo) => {
    const rec = listaRecibosCache.find(r => r.id === idRecibo);
    if (!rec) return;

    ticketPOSActual = {
        idReciboExistente: rec.id,
        items: JSON.parse(JSON.stringify(rec.items || []))
    };

    document.getElementById('pos-cliente').value = rec.cliente;
    document.getElementById('pos-metodo-pago').value = rec.metodo || 'Efectivo';
    renderizarTicketPOS();
    navegarA('ficha');
    mostrarNotificacion(`✏️ Comprobante ${rec.numRecibo} cargado en la ficha para editar.`, 'exito');
};

function generarPDFReciboIndividual(recibo) {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) {
        mostrarNotificacion('❌ Cargando librería PDF... Intente en 3 segundos.', 'error');
        return;
    }
    const docPdf = new jsPDFLib();

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(18);
    docPdf.text("D'MAR BEAUTY HOUSE", 105, 18, { align: 'center' });

    docPdf.setFontSize(12);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text("Comprobante Oficial de Atención", 105, 25, { align: 'center' });
    docPdf.text(`Comprobante No: ${recibo.numRecibo} | Fecha: ${recibo.fecha}`, 105, 31, { align: 'center' });

    docPdf.line(14, 35, 196, 35);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text(`CLIENTA: ${recibo.cliente.toUpperCase()}`, 14, 43);
    docPdf.text(`MÉTODO DE PAGO: ${(recibo.metodo || 'EFECTIVO').toUpperCase()}`, 130, 43);

    const filas = (recibo.items || []).map(i => [
        i.tipo,
        i.nombre,
        i.estilista || 'N/A',
        i.cantidad,
        formatearQ(i.precioUnitario),
        formatearQ(i.subtotal)
    ]);

    docPdf.autoTable({
        startY: 48,
        head: [['Tipo', 'Concepto', 'Estilista', 'Cant.', 'Precio', 'Subtotal']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFontSize(12);
    docPdf.text(`SUMA GENERAL: ${formatearQ(recibo.total)}`, 14, finalY);

    if (recibo.saldoPendiente > 0) {
        docPdf.text(`ABONADO: ${formatearQ(recibo.abonoInicial)}`, 14, finalY + 6);
        docPdf.text(`SALDO PENDIENTE: ${formatearQ(recibo.saldoPendiente)}`, 14, finalY + 12);
    }

    docPdf.save(`Comprobante_${recibo.numRecibo}_DMar.pdf`);
}

// INVENTARIO DE PRODUCTOS
onSnapshot(productosRef, (snapshot) => {
    listaProductosCache = [];
    snapshot.forEach((docSnapshot) => {
        listaProductosCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    listaProductosCache.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));
    renderizarProductos(listaProductosCache);
});

function renderizarProductos(productos) {
    tablaProductos.innerHTML = '';
    if (productos.length === 0) {
        tablaProductos.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">No hay productos.</td></tr>`;
        return;
    }

    productos.forEach((prod) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><strong style="color: var(--accent-color);">${prod.codigo}</strong></td>
            <td><strong>${prod.nombre}</strong></td>
            <td style="text-align: center;">${formatearQ(prod.precio)}</td>
            <td style="text-align: center;"><span class="stock-badge">${prod.stock}</span></td>
            <td style="text-align: center;">
                <button onclick="abrirModalEdicion('${prod.id}', '${prod.codigo}', '${prod.nombre}', ${prod.precio}, ${prod.stock})" style="background:#555; color:white; border:none; padding:4px 8px; border-radius:4px;">Editar</button>
            </td>
        `;
        tablaProductos.appendChild(fila);
    });
}

// CATÁLOGO DE SERVICIOS
onSnapshot(serviciosRef, (snapshot) => {
    listaServiciosCache = [];
    snapshot.forEach((docSnapshot) => {
        listaServiciosCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    listaServiciosCache.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    renderizarServicios(listaServiciosCache);
});

function renderizarServicios(servicios) {
    tablaServicios.innerHTML = '';
    if (servicios.length === 0) {
        tablaServicios.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">No hay servicios registrados.</td></tr>`;
        return;
    }

    servicios.forEach((s) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><strong>${s.nombre}</strong></td>
            <td style="text-align: center;">${formatearQ(s.precio)}</td>
            <td style="text-align: center;">
                <button onclick="abrirModalEdicionServicio('${s.id}', '${s.nombre}', ${s.precio})" style="background:#555; color:white; border:none; padding:4px 8px; border-radius:4px;">Editar</button>
            </td>
        `;
        tablaServicios.appendChild(fila);
    });
}

document.getElementById('form-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombre-serv').value.trim().toUpperCase();
    const precio = parseFloat(document.getElementById('precio-serv').value) || 0;

    try {
        await addDoc(serviciosRef, { nombre, precio, fechaCreacion: new Date() });
        document.getElementById('form-servicio').reset();
        mostrarNotificacion(`✨ Servicio "${nombre}" guardado.`, 'exito');
    } catch (error) { mostrarNotificacion('❌ Error al guardar servicio.', 'error'); }
});

// CONTROL DE ESTILISTAS
onSnapshot(comisionesRef, (snapshot) => {
    listaComisionesCache = [];
    snapshot.forEach((docSnapshot) => {
        listaComisionesCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

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

        if (!mapaEstilistas[estNombre]) {
            mapaEstilistas[estNombre] = { nombre: estNombre, totalGenerado: 0, totalComision: 0, conteo: 0, trabajos: [] };
        }

        mapaEstilistas[estNombre].totalGenerado += precioServ;
        mapaEstilistas[estNombre].totalComision += comision;
        mapaEstilistas[estNombre].conteo += 1;
        mapaEstilistas[estNombre].trabajos.push(s);

        totalServiciosQ += precioServ;
        totalComisionQ += comision;
        totalConteo += 1;
    });

    document.getElementById('stat-estilistas-total-servicios').textContent = formatearQ(totalServiciosQ);
    document.getElementById('stat-estilistas-total-comision').textContent = formatearQ(totalComisionQ);
    document.getElementById('stat-estilistas-conteo').textContent = totalConteo;

    contenedorResumen.innerHTML = '';
    tablaDetalles.innerHTML = '';

    const lista = Object.values(mapaEstilistas);
    if (lista.length === 0) {
        contenedorResumen.innerHTML = `<p style="text-align: center; color: #888;">No hay comisiones en este período.</p>`;
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;`;

    lista.forEach(est => {
        const card = document.createElement('div');
        card.style.cssText = `background: rgba(255, 152, 0, 0.05); border: 1px solid var(--border-color); border-radius: 10px; padding: 15px;`;
        card.innerHTML = `
            <h3 style="color: var(--accent-color); font-size: 1.1rem;">✂️ ${est.nombre}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Servicios: <strong>${est.conteo}</strong> | Total: <strong>${formatearQ(est.totalGenerado)}</strong></p>
            <p style="font-size: 0.95rem; color: #ffb74d; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px; margin-top: 5px;">Comisión (30%): ${formatearQ(est.totalComision)}</p>
        `;
        grid.appendChild(card);

        est.trabajos.forEach(t => {
            const precioS = parseFloat(t.precioTotal || t.monto || 0);
            const comS = precioS * 0.30;
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td><small>${t.fecha}</small></td>
                <td><strong style="color: var(--accent-color);">${est.nombre}</strong></td>
                <td><strong>${(t.concepto || '').replace('SERVICIO: ', '')}</strong></td>
                <td>${t.cliente.toUpperCase()}</td>
                <td style="text-align: center;">${formatearQ(precioS)}</td>
                <td style="text-align: center;"><strong style="color: #ffb74d;">${formatearQ(comS)}</strong></td>
            `;
            tablaDetalles.appendChild(fila);
        });
    });

    contenedorResumen.appendChild(grid);
}

// GENERACIÓN DE PDF Y CIERRE DE COMISIONES
window.procesarCierreMensualComisiones = () => {
    if (listaComisionesCache.length === 0) {
        mostrarNotificacion('⚠️ No hay datos de comisiones para cerrar.', 'error');
        return;
    }

    confirmarAccion('¿Confirma el Cierre Mensual de Comisiones? Se descargará el reporte en PDF.', async () => {
        generarPDFComisionesEstilistas();
        for (const docCom of listaComisionesCache) {
            await deleteDoc(doc(db, "comisiones_estilistas", docCom.id));
        }
        mostrarNotificacion('🔒 Cierre Mensual de Comisiones completado y PDF generado.', 'exito');
    });
};

function generarPDFComisionesEstilistas() {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) {
        mostrarNotificacion('❌ Cargando librería PDF... Intente en 3 segundos.', 'error');
        return;
    }
    const docPdf = new jsPDFLib();
    const hoy = new Date().toLocaleDateString();

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(18);
    docPdf.text("D'MAR BEAUTY HOUSE", 105, 18, { align: 'center' });

    docPdf.setFontSize(12);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Reporte de Liquidación de Comisiones (30%) - ${hoy}`, 105, 25, { align: 'center' });
    docPdf.line(14, 29, 196, 29);

    const filas = listaComisionesCache.map(t => {
        const p = parseFloat(t.precioTotal || t.monto || 0);
        return [
            t.fecha || '',
            (t.estilista || 'N/A').toUpperCase(),
            (t.concepto || '').replace('SERVICIO: ', ''),
            (t.cliente || '').toUpperCase(),
            formatearQ(p),
            formatearQ(p * 0.30)
        ];
    });

    docPdf.autoTable({
        startY: 34,
        head: [['Fecha', 'Estilista', 'Servicio', 'Cliente', 'Precio Total', 'Comisión 30%']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [230, 81, 0], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    docPdf.save(`Comisiones_Estilistas_${hoy.replace(/\//g, '-')}.pdf`);
}

// HISTORIAL PERMANENTE DE TRANSACCIONES
onSnapshot(permanenteRef, (snapshot) => {
    listaPermanenteCache = [];
    snapshot.forEach((docSnapshot) => {
        listaPermanenteCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    listaPermanenteCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderizarHistorialPermanente();
    renderizarTablaCorrecciones();
});

function renderizarHistorialPermanente() {
    if (!contenedorPermanente) return;
    contenedorPermanente.innerHTML = '';

    const texto = document.getElementById('buscador-permanente') ? document.getElementById('buscador-permanente').value.toLowerCase().trim() : '';

    const filtrados = listaPermanenteCache.filter(r => {
        if (!texto) return true;
        return (r.concepto || '').toLowerCase().includes(texto) ||
               (r.cliente || '').toLowerCase().includes(texto) ||
               (r.estilista || '').toLowerCase().includes(texto) ||
               (r.fecha || '').toLowerCase().includes(texto);
    });

    if (filtrados.length === 0) {
        contenedorPermanente.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">No hay registros grabados en el historial permanente.</p>`;
        return;
    }

    const tablaDiv = document.createElement('div');
    tablaDiv.className = 'table-responsive';

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Fecha y Hora</th>
                    <th>Tipo</th>
                    <th>Concepto / Trabajo</th>
                    <th>Clienta</th>
                    <th>Estilista</th>
                    <th style="text-align: center;">Monto</th>
                    <th style="text-align: center;">Método</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtrados.forEach(reg => {
        const esGasto = reg.tipo === 'GASTO';
        html += `
            <tr>
                <td><small>${reg.fecha || ''}</small></td>
                <td><span style="font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:4px; background:${esGasto ? 'rgba(239,83,80,0.2)' : 'rgba(129,199,132,0.2)'}; color:${esGasto ? '#ef5350' : '#81c784'};">${reg.tipo || 'INGRESO'}</span></td>
                <td><strong>${(reg.concepto || '').toUpperCase()}</strong></td>
                <td>${(reg.cliente || 'N/A').toUpperCase()}</td>
                <td>${(reg.estilista || 'N/A').toUpperCase()}</td>
                <td style="text-align: center; font-weight: bold; color:${esGasto ? '#ef5350' : '#81c784'};">${esGasto ? '-' : ''}${formatearQ(reg.monto)}</td>
                <td style="text-align: center;"><small>${reg.metodo || 'Efectivo'}</small></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    tablaDiv.innerHTML = html;
    contenedorPermanente.appendChild(tablaDiv);
}

if (document.getElementById('buscador-permanente')) {
    document.getElementById('buscador-permanente').addEventListener('input', renderizarHistorialPermanente);
}

// CORRECCIONES & ANULACIÓN COMPLETA
function renderizarTablaCorrecciones() {
    if (!tablaCorrecciones) return;
    tablaCorrecciones.innerHTML = '';
    const texto = document.getElementById('buscador-correcciones') ? document.getElementById('buscador-correcciones').value.toLowerCase().trim() : '';

    const filtrados = listaPermanenteCache.filter(r => !texto || (r.concepto || '').toLowerCase().includes(texto) || (r.cliente || '').toLowerCase().includes(texto));

    filtrados.forEach(reg => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><small>${reg.fecha || ''}</small></td>
            <td><small>${reg.tipo || 'INGRESO'}</small></td>
            <td><strong>${(reg.concepto || '').toUpperCase()}</strong></td>
            <td>${(reg.cliente || 'N/A').toUpperCase()}</td>
            <td style="text-align: center;">${formatearQ(reg.monto)}</td>
            <td style="text-align: center;">
                <button onclick="anularRegistroPorError('${reg.id}', '${reg.concepto.replace(/'/g, "\\'")}', '${reg.tipo}', ${reg.productoId ? `'${reg.productoId}'` : 'null'}, ${reg.cantidadVendida || 1}, ${reg.timestamp || 0}, ${reg.numRecibo ? `'${reg.numRecibo}'` : 'null'})" style="background-color: #c62828; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️ Anular Registro</button>
            </td>
        `;
        tablaCorrecciones.appendChild(fila);
    });
}

window.anularRegistroPorError = (idPermanente, concepto, tipo, productoId, cantidadVendida, timestamp, numRecibo) => {
    confirmarAccion(`¿Confirma la anulación completa de "${concepto}"? Se borrará de todas las secciones, recibos e historial.`, async () => {
        try {
            await deleteDoc(doc(db, "historial_permanente", idPermanente));

            if (timestamp) {
                const qDiario = query(ventasRef, where("timestamp", "==", timestamp));
                const snapDiario = await getDocs(qDiario);
                snapDiario.forEach(async (d) => await deleteDoc(doc(db, "ventas_historial", d.id)));

                const qCom = query(comisionesRef, where("timestamp", "==", timestamp));
                const snapCom = await getDocs(qCom);
                snapCom.forEach(async (d) => await deleteDoc(doc(db, "comisiones_estilistas", d.id)));

                const qPagos = query(pagosRef, where("timestamp", "==", timestamp));
                const snapPagos = await getDocs(qPagos);
                snapPagos.forEach(async (d) => await deleteDoc(doc(db, "pagos_creditos", d.id)));
            }

            if (numRecibo) {
                const qRec = query(recibosRef, where("numRecibo", "==", numRecibo));
                const snapRec = await getDocs(qRec);
                snapRec.forEach(async (d) => await deleteDoc(doc(db, "recibos_historial", d.id)));
            }

            if (tipo === 'INGRESO' && productoId) {
                const docProd = listaProductosCache.find(p => p.id === productoId);
                if (docProd) {
                    await updateDoc(doc(db, "productos", productoId), { stock: (docProd.stock || 0) + cantidadVendida });
                }
            }

            mostrarNotificacion(`🗑️ Registro anulado por completo de todas las secciones.`, 'exito');
        } catch (error) { mostrarNotificacion('❌ Error al anular registro.', 'error'); }
    });
};

// HISTORIAL DIARIO & CAJA
onSnapshot(ventasRef, (snapshot) => {
    listaVentasCache = [];
    snapshot.forEach((docSnapshot) => {
        listaVentasCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    renderizarVentas(listaVentasCache);
});

function renderizarVentas(ventas) {
    tablaVentasHistorial.innerHTML = '';
    let totalIngresos = 0, totalEfectivo = 0, totalDigital = 0, totalGastos = 0;

    ventas.forEach((v) => {
        const montoVal = parseFloat(v.monto) || 0;
        if (v.tipo === 'GASTO') totalGastos += montoVal;
        else {
            totalIngresos += montoVal;
            if (v.metodo === 'Efectivo') totalEfectivo += montoVal;
            else totalDigital += montoVal;
        }

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><small>${v.fecha || ''}</small></td>
            <td><strong>${(v.concepto || '').toUpperCase()}</strong></td>
            <td>${(v.cliente || 'N/A').toUpperCase()}</td>
            <td><strong style="color: ${v.tipo === 'GASTO' ? '#ef5350' : '#4CAF50'};">${v.tipo === 'GASTO' ? '-' : ''}${formatearQ(montoVal)}</strong></td>
            <td><small>${v.metodo || 'Efectivo'}</small></td>
        `;
        tablaVentasHistorial.appendChild(fila);
    });

    document.getElementById('stat-total-ventas').textContent = formatearQ(totalIngresos);
    document.getElementById('stat-efectivo').textContent = formatearQ(Math.max(0, totalEfectivo - totalGastos));
    document.getElementById('stat-digital').textContent = formatearQ(totalDigital);
    document.getElementById('stat-gastos').textContent = formatearQ(totalGastos);
}

window.procesarCierreCaja = () => {
    if (listaVentasCache.length === 0) {
        mostrarNotificacion('⚠️ No hay movimientos registrados para cerrar la caja.', 'error');
        return;
    }

    confirmarAccion('¿Confirma Cierre de Caja General? Se descargará el reporte diario en PDF.', async () => {
        generarPDFCierreCajaDiario();

        for (const v of listaVentasCache) {
            await deleteDoc(doc(db, "ventas_historial", v.id));
        }
        mostrarNotificacion('🔒 Cierre de caja completado y PDF generado.', 'exito');
    });
};

function generarPDFCierreCajaDiario() {
    const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) {
        mostrarNotificacion('❌ Cargando librería PDF... Intente en 3 segundos.', 'error');
        return;
    }
    const docPdf = new jsPDFLib();
    const hoy = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let totalIngresos = 0, totalEfectivo = 0, totalDigital = 0, totalGastos = 0;

    const filas = listaVentasCache.map(v => {
        const montoVal = parseFloat(v.monto) || 0;
        if (v.tipo === 'GASTO') {
            totalGastos += montoVal;
        } else {
            totalIngresos += montoVal;
            if (v.metodo === 'Efectivo') totalEfectivo += montoVal;
            else totalDigital += montoVal;
        }

        return [
            v.fecha || '',
            (v.concepto || '').toUpperCase(),
            (v.cliente || 'N/A').toUpperCase(),
            v.metodo || 'Efectivo',
            `${v.tipo === 'GASTO' ? '-' : ''}${formatearQ(montoVal)}`
        ];
    });

    const netoEfectivo = Math.max(0, totalEfectivo - totalGastos);

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(18);
    docPdf.text("D'MAR BEAUTY HOUSE", 105, 18, { align: 'center' });

    docPdf.setFontSize(12);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Reporte Oficial de Cierre de Caja - ${hoy}`, 105, 25, { align: 'center' });
    docPdf.line(14, 29, 196, 29);

    docPdf.autoTable({
        startY: 34,
        head: [['Fecha y Hora', 'Concepto / Trabajo', 'Cliente / Atendió', 'Método', 'Monto']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    const finalY = docPdf.lastAutoTable.finalY + 10;

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(11);
    docPdf.text("RESUMEN GENERAL DE CAJA DIARIA:", 14, finalY);

    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`· Ingreso Total Bruto: ${formatearQ(totalIngresos)}`, 14, finalY + 6);
    docPdf.text(`· Pagos Digitales / Transferencias: ${formatearQ(totalDigital)}`, 14, finalY + 12);
    docPdf.text(`· Salidas / Gastos de Caja: ${formatearQ(totalGastos)}`, 14, finalY + 18);
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.text(`· EFECTIVO NETO EN CAJA: ${formatearQ(netoEfectivo)}`, 14, finalY + 26);

    const fechaNombre = new Date().toISOString().slice(0, 10);
    docPdf.save(`Cierre_de_Caja_${fechaNombre}_DMar.pdf`);
}

// REGISTRO DE GASTO
window.abrirModalGasto = () => {
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('modal-gasto').style.display = 'flex';
};

window.cerrarModalGasto = () => { document.getElementById('modal-gasto').style.display = 'none'; };

document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const concepto = document.getElementById('gasto-concepto').value.trim().toUpperCase();
    const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
    const origen = document.getElementById('gasto-origen').value;

    if (monto <= 0) return;

    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mesAnioStr = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

    const gastoData = {
        tipo: 'GASTO',
        concepto: `GASTO: ${concepto}`,
        cliente: 'SISTEMA',
        monto: monto,
        metodo: origen,
        fecha: fechaStr,
        mesAnio: mesAnioStr,
        timestamp: ahora.getTime()
    };

    try {
        await addDoc(ventasRef, gastoData);
        await addDoc(permanenteRef, gastoData);
        cerrarModalGasto();
        mostrarNotificacion(`💸 Gasto de ${formatearQ(monto)} registrado.`, 'exito');
    } catch (error) { mostrarNotificacion('❌ Error al registrar el gasto.', 'error'); }
});

// MODALES EDICIONES PRODUCTOS Y SERVICIOS
window.abrirModalEdicion = (id, codigo, nombre, precio, stock) => {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-codigo').value = codigo;
    document.getElementById('edit-nombre').value = nombre;
    document.getElementById('edit-precio').value = precio;
    document.getElementById('edit-stock').value = stock;
    document.getElementById('modal-edicion').style.display = 'flex';
};
window.cerrarModalEdicion = () => document.getElementById('modal-edicion').style.display = 'none';

document.getElementById('form-editar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    await updateDoc(doc(db, "productos", id), {
        codigo: document.getElementById('edit-codigo').value.toUpperCase(),
        nombre: document.getElementById('edit-nombre').value.toUpperCase(),
        precio: parseFloat(document.getElementById('edit-precio').value) || 0,
        stock: parseInt(document.getElementById('edit-stock').value) || 0
    });
    cerrarModalEdicion();
    mostrarNotificacion('✏️ Producto actualizado.', 'exito');
});

window.abrirModalEdicionServicio = (id, nombre, precio) => {
    document.getElementById('edit-serv-id').value = id;
    document.getElementById('edit-serv-nombre').value = nombre;
    document.getElementById('edit-serv-precio').value = precio;
    document.getElementById('modal-edicion-servicio').style.display = 'flex';
};
window.cerrarModalEdicionServicio = () => document.getElementById('modal-edicion-servicio').style.display = 'none';

document.getElementById('form-editar-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-serv-id').value;
    await updateDoc(doc(db, "servicios", id), {
        nombre: document.getElementById('edit-serv-nombre').value.toUpperCase(),
        precio: parseFloat(document.getElementById('edit-serv-precio').value) || 0
    });
    cerrarModalEdicionServicio();
    mostrarNotificacion('✏️ Servicio actualizado.', 'exito');
});