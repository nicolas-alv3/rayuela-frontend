<template>
  <div>
    <!-- Botón para abrir el modal -->
    <v-btn color="blue" variant="elevated" block size='large' @click="openModal">
      <v-icon style="margin-right: 8px" left size="large">mdi-map-marker-plus</v-icon>
      Registrar Check-in
    </v-btn>

    <!-- Modal principal para registrar el check-in -->
    <v-dialog v-model="showModal" persistent max-width="800px">
      <v-card>
        <v-card-title>
          <span class="text-h6">Registrar Check-in</span>
        </v-card-title>

        <v-card-text>
          <!-- Spinner mientras se busca la ubicación -->
          <div v-if="loadingLocation" class="text-center">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p>Estamos buscando tu localización...</p>
          </div>

          <!-- Formulario -->
          <v-form v-else>
            <!-- Sección: Ubicación -->
            <h4>Ubicación</h4>

            <!-- Mapa interactivo con pin arrastrable -->
            <div style="display:flex;gap:16px;flex-direction:column;">
              <div style="position:relative;">
                <div ref="mapRef" class="checkin-map"></div>

                <button
                  type="button"
                  @click="centerOnCurrentLocation"
                  style="position:absolute; top:10px; right:10px; z-index: 12;"
                  class="v-btn v-btn--icon"
                  title="Centrar en mi ubicación"
                >
                  <v-icon>mdi-crosshairs-gps</v-icon>
                </button>

                <div style="position:absolute; bottom:10px; left:10px; background: rgba(255,255,255,0.95); padding:8px;border-radius:6px; z-index:12; font-size:13px;">
                  <span v-if="props.manualLocationEnabled">Arrastra el marcador o haz click para indicar dónde registrar el check-in.</span>
                  <span v-else>Esta es la ubicación que se registrará.</span>
                </div>
              </div>
            </div>

            <!-- Sección: Fecha y Hora -->
            <h4 class="mt-4">Fecha y Hora</h4>
            <v-text-field
                label="Timestamp"
                v-model="form.datetime"
                type="datetime-local"
                outlined
            ></v-text-field>

            <!-- Sección: Tipo de Tarea -->
            <h4 class="mt-4">Tipo de Tarea</h4>
            <v-select
                label="Tipo de tarea"
                v-model="form.taskType"
                :items="props.taskTypes"
                outlined
            ></v-select>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="closeModal" :disabled="loadingCheckin">Cancelar</v-btn>
          <v-btn
              color="primary"
              @click="submitForm"
              :disabled="loadingCheckin"
          >
            <template v-if="loadingCheckin">
              <v-progress-circular indeterminate color="white" size="20" class="mr-2"></v-progress-circular>
              Guardando...
            </template>
            <template v-else>Guardar</template>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Modal de confirmación -->
    <v-dialog v-model="serviceResponse" persistent max-width="400px">
      <v-card>
        <v-card-text class="text-center">
          <v-icon color="green" size="48">mdi-check-circle-outline</v-icon>
          <h3>¡Checkin registrado!</h3>
          <div style="border: 2px dashed lightblue; border-radius: 18px"
               v-for="(badge, index) in serviceResponse?._gameStatus?.newBadges" :key="index" class="badge-item">
            <h4>Nueva medalla!</h4>
            <img :src="badge.imageUrl" alt="Imagen de la insignia" style="max-height: 120px; object-fit: contain; margin: 8px auto;"/>"/>
            <h6>{{ badge.name }}</h6>
            <small>{{ badge.description }}</small>
          </div>
          <p v-if="serviceResponse?._gameStatus?.newPoints">
            Sumaste {{ serviceResponse._gameStatus.newPoints }}
            puntos!</p>
          <p v-if="serviceResponse?.contributesTo">Contribuiste a {{ serviceResponse.contributesTo?.name }}</p>
          <p v-else>No contribuiste a ninguna tarea</p>
          <v-alert v-if="serviceResponse?.contributesTo"
                   width="100%"
          >
            <h4>Como sentiste la tarea?</h4>
            <hr>
            <v-rating v-model="form.rating" background-color="grey lighten-2" color="orange"
                      :item-labels="['Aburrida', '', '', '', 'Divertida']"
                      item-label-position="bottom" large></v-rating>
          </v-alert>

        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="closeConfirmationModal">Aceptar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import {ref, watch, nextTick, onUnmounted} from 'vue';
import {useRoute} from 'vue-router';
import {toast} from "vue3-toastify";
import GamificationService from "@/services/GamificationService";

const emit = defineEmits(['modalClosed']);
const route = useRoute();

const showModal = ref(false);
const serviceResponse = ref(null);
const manualLocation = ref(false);
const loadingLocation = ref(false);
const loadingCheckin = ref(false);
const props = defineProps({
  taskTypes: Array,
  manualLocationEnabled: Boolean
});

const form = ref({
  latitude: '',
  longitude: '',
  datetime: '',
  taskType: '',
  rating: 0,
});

// --- Nuevas referencias y variables para el mapa ---
import 'ol/ol.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import {OSM} from 'ol/source';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import {Style, Fill, Stroke, Circle as OlCircle} from 'ol/style';
import {fromLonLat, toLonLat} from 'ol/proj';
import Translate from 'ol/interaction/Translate';
import Collection from 'ol/Collection';

const mapRef = ref(null);
let map = null;
let markerFeature = null;
let markerLayer = null;
let translateInteraction = null;
let clickHandler = null; // <-- nuevo
// -----------------------------------------------------------------

const openModal = () => {
  resetForm();
  showModal.value = true;
  loadingLocation.value = true;
  getCurrentLocation();
  // Inicializar mapa después de que el modal y DOM estén listos
  nextTick(() => {
    initializeMap();
  });
};

const toggleManualLocation = () => {
  manualLocation.value = !manualLocation.value;
  if (!manualLocation.value) {
    getCurrentLocation();
  }
};

const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    toast.info('La geolocalización no es compatible con este navegador.');
    manualLocation.value = true;
    loadingLocation.value = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
      (position) => {
        form.value.latitude = position.coords.latitude.toFixed(6);
        form.value.longitude = position.coords.longitude.toFixed(6);
        loadingLocation.value = false;
        // Si el mapa ya está inicializado, centrar y mover el pin
        if (markerFeature && map) {
          const coords = fromLonLat([parseFloat(form.value.longitude), parseFloat(form.value.latitude)]);
          markerFeature.getGeometry().setCoordinates(coords);
          map.getView().setCenter(coords);
        }
      },
      () => {
        toast.info('No se pudo obtener la ubicación. Podés mover el pin en el mapa.');
        manualLocation.value = true;
        loadingLocation.value = false;
      },
      { enableHighAccuracy: true }
  );
};

const resetForm = () => {
  form.value = {
    latitude: '',
    longitude: '',
    datetime: new Date().toISOString().slice(0, 16),
    taskType: '',
  };
  manualLocation.value = false;
};

// Inicializa un mapa simple con un marcador arrastrable
const initializeMap = () => {
  if (map || !mapRef.value) return;

  // centro por defecto (si no hay coords)
  const defaultCoords = fromLonLat([-58.3816, -34.6037]); // Buenos Aires como fallback

  const centerCoords = (form.value.longitude && form.value.latitude)
      ? fromLonLat([parseFloat(form.value.longitude), parseFloat(form.value.latitude)])
      : defaultCoords;

  const tileLayer = new TileLayer({
    source: new OSM()
  });

  markerFeature = new Feature({
    geometry: new Point(centerCoords)
  });

  markerFeature.setStyle(new Style({
    image: new OlCircle({
      radius: 12, // marcador más visible
      fill: new Fill({color: '#1976D2'}),
      stroke: new Stroke({color: 'white', width: 2})
    })
  }));

  const source = new VectorSource({
    features: [markerFeature]
  });

  markerLayer = new VectorLayer({
    source
  });

  map = new Map({
    target: mapRef.value,
    layers: [tileLayer, markerLayer],
    view: new View({
      center: centerCoords,
      zoom: 16
    })
  });

  // Solo permitir modificar la ubicación si el proyecto lo tiene habilitado
  if (props.manualLocationEnabled) {
    // Interacción para arrastrar el marcador
    translateInteraction = new Translate({
      features: new Collection([markerFeature])
    });

    translateInteraction.on('translating', () => {
      const geom = markerFeature.getGeometry();
      const lonlat = toLonLat(geom.getCoordinates());
      form.value.latitude = lonlat[1].toFixed(6);
      form.value.longitude = lonlat[0].toFixed(6);
    });

    translateInteraction.on('translateend', () => {
      const geom = markerFeature.getGeometry();
      const lonlat = toLonLat(geom.getCoordinates());
      form.value.latitude = lonlat[1].toFixed(6);
      form.value.longitude = lonlat[0].toFixed(6);
    });

    map.addInteraction(translateInteraction);

    // Permitir mover el marcador haciendo click en el mapa (UX esperado)
    clickHandler = (evt) => {
      if (!markerFeature) return;
      const coord = evt.coordinate;
      markerFeature.getGeometry().setCoordinates(coord);
      const lonlat = toLonLat(coord);
      form.value.latitude = lonlat[1].toFixed(6);
      form.value.longitude = lonlat[0].toFixed(6);
    };
    map.on('singleclick', clickHandler);
  }

  // Forzar redimensionado después de que el modal esté visible (evita lienzo en blanco)
  setTimeout(() => {
    try { map.updateSize(); } catch (e) { /* noop */ }
  }, 250);

  // Si no teníamos coords iniciales, rellenarlas desde el centro del pin
  if (!form.value.latitude || !form.value.longitude) {
    const lonlat = toLonLat(centerCoords);
    form.value.latitude = lonlat[1].toFixed(6);
    form.value.longitude = lonlat[0].toFixed(6);
  }
};

const centerOnCurrentLocation = () => {
  if (!navigator.geolocation) {
    toast.warning('La geolocalización no está disponible en este navegador.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = fromLonLat([position.coords.longitude, position.coords.latitude]);
        if (map) {
          map.getView().setCenter(coords);
          map.getView().setZoom(16);
          // mover pin también
          if (markerFeature) {
            markerFeature.getGeometry().setCoordinates(coords);
            form.value.latitude = position.coords.latitude.toFixed(6);
            form.value.longitude = position.coords.longitude.toFixed(6);
          }
        }
      },
      () => {
        toast.warning('No se pudo obtener la ubicación actual.');
      },
      { enableHighAccuracy: true }
  );
};

const closeModal = () => {
  showModal.value = false;
  loadingCheckin.value = false;
  // limpiar mapa para evitar fugas
  if (map) {
    try {
      if (clickHandler) map.un('singleclick', clickHandler);
      if (translateInteraction && map) map.removeInteraction(translateInteraction);
    } catch (e) { /* noop */ }
    map.setTarget(null);
    map = null;
    markerFeature = null;
    markerLayer = null;
    translateInteraction = null;
    clickHandler = null;
  }
};

onUnmounted(() => {
  if (map) {
    try {
      if (clickHandler) map.un('singleclick', clickHandler);
      if (addCurrentLocationToMap?.intervalId) clearInterval(addCurrentLocationToMap.intervalId);
    } catch (e) {}
    map.setTarget(null);
    map = null;
  }
});

const closeConfirmationModal = async () => {
  if (serviceResponse.value.contributesTo) {
    await GamificationService.rate(form.value.rating, serviceResponse.value.id);
  }
  serviceResponse.value = null;
  emit('modalClosed');
};

const submitForm = () => {
  if (!form.value.latitude || !form.value.longitude || !form.value.taskType) {
    toast.info('Por favor completa todos los campos.');
    return;
  }

  loadingCheckin.value = true;

  GamificationService.registerCheckin({...form.value, projectId: route.params.projectId})
      .then((res) => {
        serviceResponse.value = res;
      })
      .catch(() => toast.error('Ha ocurrido un error en el registro.'))
      .finally(() => {
        loadingCheckin.value = false;
        closeModal();
      });
};

watch(showModal, (isVisible) => {
  if (isVisible) {
    const now = new Date();
    const gmtMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000); // GMT-3
    form.value.datetime = gmtMinus3.toISOString().slice(0, 16);
    // asegurar inicialización del mapa si se abre ya con DOM disponible
    nextTick(() => {
      // esperar un frame extra si el modal tiene transición
      setTimeout(() => initializeMap(), 120);
      // y forzar updateSize poco después
      setTimeout(() => { if (map) try { map.updateSize(); } catch(e) {} }, 400);
    });
  } else {
    // limpiar mapa cuando se cierra
    if (map) {
      map.setTarget(null);
      map = null;
    }
  }
});
</script>

<style scoped>
.text-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.mt-4 {
  margin-top: 16px;
}

.mr-2 {
  margin-right: 8px;
}

/* Estilos para el mapa del checkin */
.checkin-map {
  width: 100%;
  height: 360px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}

/* Responsive: altura menor en pantallas pequeñas */
@media (max-width: 600px) {
  .checkin-map {
    height: 280px;
  }
}
</style>
