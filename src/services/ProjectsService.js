import axios from "axios";
import RayuelaService from "@/services/RayuelaService";

class ProjectsService extends RayuelaService{
    getProjects() {
        return axios.get(this.baseUrl + `/projects/`, this.getHeaders())
            .then((response) => response.data);
    }

    async getDiffProjects() {
        return axios.get(this.baseUrl + `/projects/`, this.getHeaders())
            .then(res => res.data)
    }
}

export default new ProjectsService(); // Sinleton pattern