
import { hasPermission, ROLES } from "../shared/permissions";

const resource = "roster";
const action = "write";

console.log("--- Testing Permission Checks ---");

const lowercase = "admin";
console.log(`Checking '${lowercase}':`, hasPermission(lowercase as any, resource, action));

const capitalized = "Admin";
console.log(`Checking '${capitalized}':`, hasPermission(capitalized as any, resource, action));

console.log("--- ROLES array ---");
console.log(ROLES);
