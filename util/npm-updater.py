import json
import subprocess as sp
import subprocess  # Used for executing shell commands securely
import shlex  # Used for properly splitting command strings

print("--- Updating npm Packages ---")
outdated_pkg_json = json.loads(sp.getoutput('npm outdated --json'))

for pkg in outdated_pkg_json:
  print(f"--- Updating: {pkg} ---")
  if pkg == "gatsby":
    subprocess.call(shlex.split('npm install gatsby@latest'))
  else:
    subprocess.call(shlex.split(f'npm update {pkg}'))

print("Remaining Updates (if any):")
subprocess.run(['npm', 'outdated'])

print("--- Finished ---")