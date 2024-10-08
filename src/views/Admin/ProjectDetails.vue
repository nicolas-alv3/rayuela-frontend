<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ProjectsService from '@/services/ProjectsService';
import { toast } from 'vue3-toastify';

const route = useRoute();
const project = ref({
  name: '',
  description: '',
  image: '',
  web: '',
  available: false,
  areas: [],
  taskTypes: [],
  timeIntervals: []
});
const isNew = ref(false);

const daysOfWeek = [
  { value: 1, text: 'Lunes' },
  { value: 2, text: 'Martes' },
  { value: 3, text: 'Miércoles' },
  { value: 4, text: 'Jueves' },
  { value: 5, text: 'Viernes' },
  { value: 6, text: 'Sábado' },
  { value: 7, text: 'Domingo' }
];

onMounted(async () => {
  const projectId = route.params.id;

  if (projectId === 'new') {
    isNew.value = true;
    project.value = {
      name: '',
      description: '',
      image: '',
      web: '',
      available: false,
      areas: [],
      taskTypes: [],
      timeIntervals: []
    };
  } else {
    project.value = await ProjectsService.getProjectById(projectId);
  }
});

const saveProject = async () => {
  if (isNew.value) {
    await ProjectsService.createProject(project.value);
    toast.success('Proyecto creado exitosamente');
  } else {
    await ProjectsService.updateProject(project.value);
    toast.success('Proyecto actualizado exitosamente');
  }
};
</script>

<template>
  <v-container>
    <h1>{{ isNew ? 'Crear nuevo proyecto' : 'Editar proyecto' }}</h1>

    <v-form @submit.prevent="saveProject">
      <v-text-field label="Nombre del proyecto" v-model="project.name" required />
      <v-textarea label="Descripción del proyecto" v-model="project.description" required />
      <v-text-field label="URL de la imagen" v-model="project.image" />
      <v-text-field label="Sitio web del proyecto" v-model="project.web" />
      <v-switch label="Disponible" v-model="project.available" />

      <v-card class="pa-4 mb-4">
        <h3>Áreas</h3>
        <div v-for="(area, index) in project.areas" :key="index">
          <v-text-field label="ID del área" v-model="area.id" />
          <v-text-field label="Tipo" v-model="area.type" />
          <v-text-field label="Fuente" v-model="area.properties.source_object" />
          <v-text-field label="Posición" v-model="area.properties.pos" />
        </div>
      </v-card>

      <v-card class="pa-4 mb-4">
        <h3>Tipos de tareas</h3>
        <v-select
            v-model="project.taskTypes"
            :items="['Sacar fotos', 'Llenar formularios']"
            label="Tipos de tareas"
            multiple
            chips
        />
      </v-card>

      <v-card class="pa-4 mb-4">
        <h3>Intervalos de tiempo</h3>
        <div v-for="(interval, index) in project.timeIntervals" :key="index">
          <v-text-field label="Nombre del intervalo" v-model="interval.name" />
          {{[interval.time.start,interval.time.end]}}
          <v-range-slider
              :model-value="[interval.time.start,interval.time.end]"
              label="Intervalo de tiempo"
              :max="24"
              :min="0"
              ticks
              step="1"
              tick-size="2"
              thumb-label="always"
          />
          <h4>Días de la semana</h4>
          <div v-for="day in daysOfWeek" :key="day.value">
            <v-checkbox
                v-model="interval.days"
                :label="day.text"
                :value="day.value"
            />
          </div>
        </div>
      </v-card>

      <v-btn type="submit" variant="elevated" color="black" width="100%" >{{ isNew ? 'Crear' : 'Actualizar' }}</v-btn>
    </v-form>
  </v-container>
</template>
