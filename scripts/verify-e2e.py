import httpx, sys, time
TS = str(int(time.time()))
REGIONS = ["South Delhi", "North Delhi", "East Delhi", "West Delhi", "Central Delhi", "Gurugram", "Noida", "Faridabad"]
REG = REGIONS[int(time.time()) % len(REGIONS)]

BASE = "http://localhost:8000"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'}: {name} {detail}")


PW = "astra-demo-2026"


def login(email):
    r = httpx.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": PW})
    return r.json()["access_token"]


citizen_token = login("citizen@astra.dev")
admin_token = login("admin@astra.dev")
h_c = {"Authorization": f"Bearer {citizen_token}"}
h_a = {"Authorization": f"Bearer {admin_token}"}

# 1. Auth
r = httpx.get(f"{BASE}/api/v1/auth/me", headers=h_c)
check("auth me (citizen)", r.status_code == 200)

# 2. Incidents (citizen creates)
r = httpx.post(
    f"{BASE}/api/v1/incidents",
    headers=h_c,
    data={
        "title": f"Smoke rising from building block {TS}",
        "description": f"Heavy smoke visible near the tower, people evacuating {TS}",
        "category": "Fire",
        "region": REG,
    },
)
check("incident create", r.status_code == 201, r.status_code)
inc_id = r.json()["id"] if r.status_code == 201 else None
r = httpx.get(f"{BASE}/api/v1/incidents", headers=h_c)
check("incident list", r.status_code == 200)
r = httpx.get(f"{BASE}/api/v1/incidents/{inc_id}", headers=h_c)
print("DEBUG detail:", r.status_code, r.text[:120])
check("incident detail", r.status_code == 200)

# 3. Tasks (admin)
r = httpx.post(
    f"{BASE}/api/v1/incidents/{inc_id}/tasks",
    headers=h_a,
    json={"title": "Respond", "department": "Fire", "assignee_ids": []},
)
check("task create", r.status_code == 201, r.status_code)
task_id = r.json()["id"] if r.status_code == 201 else None
r = httpx.get(f"{BASE}/api/v1/incidents/{inc_id}/tasks", headers=h_a)
check("task list", r.status_code == 200 and (task_id is None or len(r.json()) >= 1))
r = httpx.patch(f"{BASE}/api/v1/tasks/{task_id}", headers=h_a, json={"status": "DONE"})
check(
    "task transition (skip OPEN->DONE)",
    r.status_code == 200 and r.json()["status"] == "DONE",
    r.status_code,
)
r = httpx.patch(f"{BASE}/api/v1/tasks/{task_id}", headers=h_a, json={"status": "OPEN"})
check("task backwards -> 409", r.status_code == 409, r.status_code)
r = httpx.post(
    f"{BASE}/api/v1/tasks/{task_id}/updates",
    headers=h_a,
    json={"note": "done", "status": "DONE"},
)
check("task update", r.status_code == 201, r.status_code)

# 4. Phase (admin)
r = httpx.post(
    f"{BASE}/api/v1/incidents/{inc_id}/phase",
    headers=h_a,
    json={"phase": "COORDINATING"},
)
r2 = r
phase_ok = r2.status_code == 200 or (r2.status_code == 409 and "already" in r2.text)
check("phase set", phase_ok, r2.status_code)

# 5. Close with open task -> 409
r2 = httpx.post(
    f"{BASE}/api/v1/incidents",
    headers=h_c,
    data={
        "title": f"Waterlogging on main road {TS}",
        "description": f"Street flooded after drain overflow {TS}",
        "category": "Fire",
        "region": REG,
    },
)
inc2 = r2.json()["id"]
httpx.post(
    f"{BASE}/api/v1/incidents/{inc2}/tasks",
    headers=h_a,
    json={"title": "T2", "department": "Fire"},
)
r = httpx.post(f"{BASE}/api/v1/incidents/{inc2}/close", headers=h_a, json={})
check("close with open task -> 409", r.status_code == 409, r.status_code)
# close original (no open tasks)
r = httpx.post(
    f"{BASE}/api/v1/incidents/{inc_id}/close", headers=h_a, json={"note": "done"}
)
check(
    "close incident",
    r.status_code == 200 and r.json()["lifecycle"] == "CLOSED",
    r.status_code,
)

# 6. Alerts (admin creates)
r = httpx.post(
    f"{BASE}/api/v1/alerts",
    headers=h_a,
    json={"event": "Fire", "title": "Alert", "body": "body", "severity": "HIGH"},
)
check("alert create", r.status_code == 201, r.status_code)
r = httpx.get(f"{BASE}/api/v1/alerts", headers=h_c)
check("alert list (citizen)", r.status_code == 200, r.status_code)
r = httpx.post(
    f"{BASE}/api/v1/alerts/preferences",
    headers=h_c,
    json={"region": REG, "category": "Fire", "enabled": True},
)
check("alert pref upsert", r.status_code == 201, r.status_code)

# 7. Stats
r = httpx.get(f"{BASE}/api/v1/stats/overview", headers=h_c)
check("stats overview (citizen) -> 403", r.status_code == 403, r.status_code)
r = httpx.get(f"{BASE}/api/v1/stats/overview", headers=h_a)
check("stats overview (admin)", r.status_code == 200, r.status_code)

# 8. Audit
r = httpx.get(f"{BASE}/api/v1/audit/logs", headers=h_a)
check("audit logs", r.status_code == 200, r.status_code)
r = httpx.get(f"{BASE}/api/v1/audit/logs", headers=h_c)
check("audit citizen -> 403", r.status_code == 403, r.status_code)

# 9. Voice
r = httpx.post(
    f"{BASE}/api/v1/voice/tts",
    headers=h_c,
    json={"text": "namaste", "language_code": "hi-IN"},
    timeout=90,
)
check("voice tts", r.status_code == 200 and len(r.content) > 1000, r.status_code)
audio = r.content
files = {"audio": ("a.wav", audio, "audio/wav")}
data = {"language_code": "hi-IN"}
r = httpx.post(
    f"{BASE}/api/v1/voice/stt", headers=h_c, files=files, data=data, timeout=90
)
check("voice stt", r.status_code == 200, r.status_code)
r = httpx.get(f"{BASE}/api/v1/voice/languages", headers=h_c)
check("voice languages", r.status_code == 200 and len(r.json()) > 0, r.status_code)

# 10. Simulations
r = httpx.post(
    f"{BASE}/api/v1/simulations",
    headers=h_c,
    json={
        "scenario": "fire",
        "mode": "PUBLIC",
        "params": {"category": "Fire", "radius_km": 3},
    },
)
check("sim run", r.status_code == 201 and r.json()["status"] == "DONE", r.status_code)
r = httpx.get(f"{BASE}/api/v1/simulations", headers=h_c)
check("sim list", r.status_code == 200, r.status_code)

# 11. Routing
r = httpx.get(f"{BASE}/api/v1/route/locations", headers=h_c)
check("route locations", r.status_code == 200, r.status_code)

# 12. Assistant
r = httpx.post(
    f"{BASE}/api/v1/assistant/conversations",
    headers=h_c,
    json={"title": "t", "language": "en-IN"},
)
check("assistant conv create", r.status_code == 201, r.status_code)
cid = r.json()["id"]
r = httpx.post(
    f"{BASE}/api/v1/assistant/conversations/{cid}/chat",
    headers=h_c,
    json={"text": "hi", "language": "en-IN"},
    timeout=60,
)
check("assistant chat", r.status_code == 200 and "reply" in r.json(), r.status_code)

# summary
print("\n=== SUMMARY ===")
fails = [x for x in results if not x[1]]
print(f"passed: {sum(1 for x in results if x[1])}/{len(results)}")
if fails:
    for f in fails:
        print("FAIL:", f[0], f[2])
sys.exit(1 if fails else 0)
