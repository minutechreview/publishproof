import { readFile } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { approvedRetrievalService, validateRetrievalApproval, type RetrievalApproval } from "../src/server/retrieval.js";
import { searchQuery } from "../src/shared/retrieval.js";

// No configuration/key is created here. The operator supplies an already approved scope file
// and an ephemeral server-process environment secret through their own secure channel.
const path=process.argv[2];
if(!path) throw new Error("Provide the nonsecret, explicitly approved Search/Fetch scope JSON path. See docs/TINYFISH.md.");
const approval=JSON.parse(await readFile(path,"utf8")) as RetrievalApproval;
const key=process.env.TINYFISH_API_KEY;
validateRetrievalApproval(approval,approval.exactUrls,searchQuery(approval.query,approval.exactUrls[0]),key);
const service=approvedRetrievalService(approval,key!);
createApp(undefined,"public-live",service).listen(4317,"127.0.0.1",()=>
  console.log("Approved-scope Search/Fetch helper ready at http://127.0.0.1:4317. No call until both consent boxes and Check. Agent/Browser inactive. Scope is not renewed automatically."));
