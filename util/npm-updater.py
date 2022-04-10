import json
import subprocess as sp
import os

print("--- Updating npm Packages ---")
outdated_pkg_json = json.loads(sp.getoutput('npm outdated --json'))

for pkg in outdated_pkg_json:
  print(f"--- Updating: {pkg} ---")
  if pkg == "gatsby":
    os.system('npm install gatsby@latest')
  else:
    os.system(f'npm update {pkg}')

print("Remaining Updates (if any):")
os.system('npm outdated')

print("--- Finished ---")