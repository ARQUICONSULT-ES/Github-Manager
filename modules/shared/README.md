# Toast Notification System

Sistema de notificaciones tipo toast para reemplazar los `window.alert` del proyecto.

## Componentes

### Toast
Componente individual de notificación que se muestra flotando en la parte superior derecha de la pantalla.

**Props:**
- `message: string` - Mensaje a mostrar
- `type?: ToastType` - Tipo de notificación: 'success' | 'error' | 'warning' | 'info' (default: 'info')
- `duration?: number` - Duración en milisegundos antes de desaparecer (default: 3000)
- `onClose: () => void` - Callback cuando se cierra el toast

### ToastContainer
Contenedor que gestiona múltiples toasts y los apila verticalmente.

**Props:**
- `toasts: ToastMessage[]` - Array de mensajes toast a mostrar
- `onRemove: (id: string) => void` - Función para remover un toast del array

### useToast Hook
Hook personalizado para gestionar el estado de las notificaciones.

**Retorna:**
- `toasts: ToastMessage[]` - Array de toasts activos
- `showToast(message, type, duration)` - Función genérica para mostrar un toast
- `removeToast(id)` - Función para remover un toast
- `success(message, duration?)` - Atajo para mostrar toast de éxito
- `error(message, duration?)` - Atajo para mostrar toast de error
- `warning(message, duration?)` - Atajo para mostrar toast de advertencia
- `info(message, duration?)` - Atajo para mostrar toast informativo

## Uso

### 1. Importar el hook y el contenedor

```tsx
import { useToast } from "@/modules/shared/hooks/useToast";
import ToastContainer from "@/modules/shared/components/ToastContainer";
```

### 2. Usar el hook en tu componente

```tsx
export function MyComponent() {
  const { toasts, removeToast, success, error, warning, info } = useToast();

  const handleAction = async () => {
    try {
      // ... tu código
      success("Operación completada exitosamente");
    } catch (err) {
      error(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Tu contenido */}
      
      {/* Añadir el contenedor al final */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
```

### 3. Mostrar diferentes tipos de notificaciones

```tsx
// Éxito (verde)
success("Datos guardados correctamente");

// Error (rojo)
error("No se pudo conectar al servidor");

// Advertencia (amarillo)
warning("Ten cuidado con esta acción");

// Información (azul)
info("Hay una nueva actualización disponible");
```

### 4. Personalizar la duración

```tsx
// Toast que dura 5 segundos
success("Mensaje largo que necesita más tiempo", 5000);

// Toast que dura 1 segundo
info("Mensaje rápido", 1000);
```

## Estilo Visual

- **Posición**: Parte superior derecha de la pantalla (`top-4 right-4`)
- **Animación**: Se desliza desde arriba con efecto `slide-in-top`
- **Cierre**: 
  - Automático después de la duración especificada (3 segundos por defecto)
  - Manual con el botón X
- **Iconos**:
  - ✅ Éxito (verde)
  - ❌ Error (rojo)
  - ⚠️ Advertencia (amarillo)
  - ℹ️ Información (azul)

## Migración desde alert()

**Antes:**
```tsx
alert("✅ Operación completada");
alert("❌ Error al procesar");
```

**Después:**
```tsx
const { success, error } = useToast();

success("Operación completada");
error("Error al procesar");
```

## Archivos Modificados

Se reemplazaron todos los `alert()` en:
1. `modules/customers/pages/CustomerFormPage.tsx`
2. `modules/customers/pages/installedapp.tsx`
3. `modules/customers/pages/environment.tsx`
4. `modules/repos/components/RepoCard.tsx`
5. `modules/repos/components/DependenciesModal.tsx`
6. `modules/admin/components/UserFormModal.tsx`

## Consideraciones

- El contenedor ToastContainer debe ser incluido en cada página/componente que use notificaciones
- Los toasts son independientes por página (no globales entre rutas)
- Los mensajes se pueden formatear con `\n` para saltos de línea
- Los colores se adaptan automáticamente al modo oscuro/claro
