# Especificación de Seguridad Firestore — Mía Store

## 1. Invariantes de Datos
1. **Propiedad e Integridad de Identidad**: Todo pedido (`/orders/{orderId}`) debe pertenecer a un usuario autenticado con correo verificado (`request.auth.uid == incoming().userId && request.auth.token.email_verified == true`). Ningún cliente puede leer ni listar pedidos ajenos.
2. **Aislamiento de PII**: Los datos personales (`customerEmail`, `customerPhone`, `shippingAddress`) residen únicamente en `/orders/{orderId}` y solo son legibles por la clienta propietaria o por un administrador verificado.
3. **Catálogo Público Restringido**: Los visitantes anónimos solo pueden consultar prendas publicadas (`active == true`). Solo los administradores verificados pueden crear, editar precios/descripciones, eliminar productos o ver productos ocultos.
4. **Control de Inventario en Compra**: Al confirmar una compra, una clienta verificada solo puede decrementar el campo `stock` de un producto (`stock >= 0 && stock < existing().stock`) y actualizar `updatedAt == request.time`. No puede alterar precio, nombre, categoría ni estado activo.
5. **Integridad Temporal y Estados Terminales**: `createdAt` y `updatedAt` se validan estrictamente contra `request.time`. Solo los administradores pueden avanzar o revertir estados de pedido (`pendiente` -> `preparando` -> `enviado` -> `entregado` / `cancelado`).

## 2. "Dirty Dozen" — 12 Cargas Maliciosas de Prueba (Deben devolver PERMISSION_DENIED)
1. **Shadow Field en Producto**: Crear producto como admin incluyendo campo fantasma `{ ..., "isPromoSecret": true }` -> Rechazado por `hasOnly`.
2. **Escalada de Privilegios**: Usuario normal intenta crear `/admins/{myUid}` -> Rechazado por `isAdmin()`.
3. **Spoofing de Email Admin**: Usuario con `email: "miastore0527@gmail.com"` pero `email_verified: false` intenta crear producto -> Rechazado por verificación `email_verified == true`.
4. **Lectura PII Ajena**: Usuario A intenta `get` o `list` sobre pedido perteneciente a Usuario B -> Rechazado por `resource.data.userId == request.auth.uid`.
5. **Query Sin Filtro Seguro**: Usuario autenticado intenta `list` sobre `/orders` sin filtrar por su `userId` -> Rechazado por evaluación de `resource.data.userId == request.auth.uid`.
6. **ID Poisoning**: Intento de crear documento con ID de 500 caracteres o caracteres inválidos (`../../hack`) -> Rechazado por `isValidId()`.
7. **Manipulación de Precio en Compra**: Compradora intenta actualizar `price: 1` junto con `stock` al hacer checkout -> Rechazado por `affectedKeys().hasOnly(['stock', 'updatedAt'])`.
8. **Stock Negativo / Incremento Fraudulento**: Compradora intenta establecer `stock: -5` o `stock: 999` -> Rechazado por `incoming().stock >= 0 && incoming().stock < existing().stock`.
9. **Timestamp Falsificado**: Creación de pedido con `createdAt` en el pasado para alterar reportes -> Rechazado por `incoming().createdAt == request.time`.
10. **Suplantación de `userId` en Pedido**: Usuario A intenta crear pedido con `userId: "usuario_B"` -> Rechazado por `incoming().userId == request.auth.uid`.
11. **Array Ilimitado (Denial of Wallet)**: Pedido con 50 ítems en `items` -> Rechazado por `items.size() <= 20`.
12. **Modificación de Pedido por Clienta**: Clienta intenta cambiar `paymentStatus` de su propio pedido a `'pagado'` o cambiar `total` -> Rechazado porque `allow update` en `/orders` es exclusivo para `isAdmin()`.
