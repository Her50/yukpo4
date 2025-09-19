# Script pour modifier yukpoaclient.ts
 = Get-Content "src/lib/yukpoaclient.ts" -Raw
 =  -replace "import axios from "axios";", "import axios from "axios";
import { API_BASE_URL } from "../config/api";"
 =  -replace "'/api/ia/creation-service'", "${API_BASE_URL}/api/ia/creation-service"
Set-Content "src/lib/yukpoaclient.ts" -Value 
