<script setup>
import { onMounted, ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import BadgesService from "@/services/GamificationService";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import { store } from "@/vuex/state";
import GamificationService from "@/services/GamificationService";
import BreadCrumb from "@/components/utils/BreadCrumb.vue";
import ProjectsService from "@/services/ProjectsService";

const badges = ref([]);
const scoreRules = ref([]);

const { t } = useI18n();

const badgeHeaders = computed(() => [
  { title: t('admin.badge_name_label'), value: 'name', sortable: true },
  { title: t('common.actions'), value: 'actions', sortable: false }
]);

const scoreRuleHeaders = computed(() => [
  { title: t('admin.rule_name_label'), value: 'label', sortable: true },
  { title: t('common.actions'), value: 'actions', sortable: false }
]);

const selectedBadge = ref(null);
const selectedScoreRule = ref(null);
const dialogDisableBadge = ref(false);
const dialogDisableScoreRule = ref(false);

const project = ref({});
const gamificationDialog = ref(false);

const router = useRouter();
const route = useRoute();

onMounted(async () => {
  store.commit('setCurrentBadge', null)
  store.commit('setScoreRule', null)
  const gamification = await BadgesService.getGamification(route.params.projectId);
  store.commit('setCurrentGamification', gamification)
  badges.value = gamification.badgesRules;
  scoreRules.value = gamification.pointRules;

  project.value = await ProjectsService.getProjectById(route.params.projectId);
});

const showGamificationInfo = () => {
  gamificationDialog.value = true;
};

const saveGeneralConfig = async () => {
  try {
    await ProjectsService.updateProject({
      id: route.params.projectId,
      gamificationStrategy: project.value.gamificationStrategy,
      leaderboardStrategy: project.value.leaderboardStrategy,
      recommendationStrategy: project.value.recommendationStrategy
    });
    toast.success(t('admin.general_config_updated_success'));
  } catch (error) {
    toast.error(t('admin.general_config_save_error'));
  }
};

const editBadge = (badge) => {
  store.commit("setCurrentBadge", badge)
  router.push(`/admin/project/${route.params.projectId}/gamification/badge/${badge._id}`);
};

const addBadge = () => {
  router.push(`/admin/project/${route.params.projectId}/gamification/badge/new`);
};

const confirmDeleteBadge = (badge) => {
  selectedBadge.value = badge;
  dialogDisableBadge.value = true;
};

const deleteBadge = async () => {
  selectedBadge.value.available = !selectedBadge.value.available;
  await GamificationService.deleteBadge(selectedBadge.value._id)
    .then((res) => {
      toast.success(t('admin.badge_deleted_success'));
      dialogDisableBadge.value = false;
      badges.value = res.badges;
    });
};

const editScoreRule = (scoreRule) => {
  store.commit("setScoreRule", scoreRule)
  router.push(`/admin/project/${route.params.projectId}/gamification/score-rule/${scoreRule._id}`);
};

const addScoreRule = () => {
  router.push(`/admin/project/${route.params.projectId}/gamification/score-rule/new`);
};

const confirmDisableScoreRule = (scoreRule) => {
  selectedScoreRule.value = scoreRule;
  dialogDisableScoreRule.value = true;
};

const deleteScoreRule = async () => {
  await GamificationService.deleteScoreRule(selectedScoreRule.value._id)
    .then((res) => {
      toast.success(t('admin.score_rule_deleted_success'));
      dialogDisableScoreRule.value = false;
      scoreRules.value = res.pointRules;
    });
};
</script>

<template>
  <main>
    <BreadCrumb items="gamificationPath" />
    <h1 class="mb-6">{{ $t('admin.edit_gamification') }}</h1>

    <!-- Sección de Insignias -->
    <v-card class="pa-4 mb-6">
      <div class="d-flex align-center mb-4">
        <h2>{{ $t('admin.badges') }}</h2>
        <v-spacer></v-spacer>
        <v-btn color="black" @click="addBadge">{{ $t('admin.add_badge') }}</v-btn>
      </div>
      <v-data-table :headers="badgeHeaders" :items="badges" :no-data-text="$t('leaderboard.no_data')"
        class="elevation-1">
        <template v-slot:item.actions="{ item }">
          <v-menu offset-y>
            <template #activator="{ props }">
              <v-btn variant="flat" v-bind="props" icon>
                <v-icon>mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="editBadge(item)">
                <v-list-item-title>{{ $t('admin.edit_badge') }}</v-list-item-title>
              </v-list-item>
              <v-list-item @click="confirmDeleteBadge(item)">
                <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-data-table>

      <v-dialog v-model="dialogDisableBadge" max-width="400px">
        <v-card>
          <v-card-title class="headline">{{ $t('admin.confirm_title') }}</v-card-title>
          <v-card-text>
            {{ $t('admin.confirm_delete_badge', { name: selectedBadge?.name }) }}
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" text @click="dialogDisableBadge = false">{{ $t('common.cancel') }}</v-btn>
            <v-btn color="warning" text @click="deleteBadge">{{ $t('common.delete') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card>

    <!-- Sección de Reglas de Puntaje -->
    <v-card class="pa-4 mb-6">
      <div class="d-flex align-center mb-4">
        <h2>{{ $t('admin.score_rules') }}</h2>
        <v-spacer></v-spacer>
        <v-btn color="black" @click="addScoreRule">{{ $t('admin.add_score_rule') }}</v-btn>
      </div>
      <v-data-table :headers="scoreRuleHeaders" :items="scoreRules" :no-data-text="$t('leaderboard.no_data')"
        class="elevation-1">
        <template v-slot:item.label="{ item }">
          {{ `[${item.score}pts] Area ${item.areaId}, Intervalo ${item.timeIntervalId}, Tipo ${item.taskType}` }}
        </template>
        <template v-slot:item.actions="{ item }">
          <v-menu offset-y>
            <template #activator="{ props }">
              <v-btn variant="flat" v-bind="props" icon>
                <v-icon>mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="editScoreRule(item)">
                <v-list-item-title>{{ $t('admin.edit_score_rule') }}</v-list-item-title>
              </v-list-item>
              <v-list-item @click="confirmDisableScoreRule(item)">
                <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-data-table>

      <v-dialog v-model="dialogDisableScoreRule" max-width="400px">
        <v-card>
          <v-card-title class="headline">{{ $t('admin.confirm_title') }}</v-card-title>
          <v-card-text>
            {{ $t('admin.confirm_delete_score_rule', { name: selectedScoreRule?.name }) }}
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" text @click="dialogDisableScoreRule = false">{{ $t('common.cancel') }}</v-btn>
            <v-btn color="warning" text @click="deleteScoreRule">{{ $t('common.delete') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card>
    <!-- Configuración General -->
    <v-card class="pa-4 mb-6" v-if="Object.keys(project).length > 0">
      <h2>{{ $t('admin.adaptations') }}</h2>
      <v-select :label="$t('admin.adaptation_type_label')" v-model="project.gamificationStrategy"
        :items="['ELASTICA', 'SIN ADAPTACION']" required>
        <template v-slot:append>
          <v-icon @click="showGamificationInfo">mdi-information</v-icon>
        </template>
      </v-select>
      <v-select :label="$t('admin.leaderboard_type_label')" v-model="project.leaderboardStrategy"
        :items="['PUNTOS PRIMERO', 'MEDALLAS PRIMERO']" required></v-select>
      <v-select :label="$t('admin.recommendation_algorithm_label')" v-model="project.recommendationStrategy"
        :items="['SIMPLE', 'ADAPTATIVO']" required></v-select>
      <v-btn color="black" block class="mt-4" @click="saveGeneralConfig">{{
        $t('admin.save_general_config')
      }}</v-btn>
    </v-card>

    <v-dialog v-model="gamificationDialog" max-width="500px">
      <v-card>
        <v-card-title>{{ $t('admin.gamification_info_title') }}</v-card-title>
        <v-card-text>
          <p>{{ $t('admin.gamification_info_text') }}</p>
          <ul>
            <li><strong>{{ $t('admin.basic') }}:</strong> Aplica reglas predefinidas sin adaptación dinámica.</li>
            <li><strong>{{ $t('admin.elastic') }}:</strong> El cálculo de retribución de puntos es relativo a la
              posición de
              cada
              persona en la tabla de posiciones. Si está más lejos, el puntaje es mayor que si está cerca.
            </li>
          </ul>
        </v-card-text>
        <v-card-actions>
          <v-btn color="black" @click="gamificationDialog = false">{{ $t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.component-container {
  display: inline-block;
}
</style>
