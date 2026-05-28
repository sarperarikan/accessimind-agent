import os
import subprocess
import zipfile
import sys
from pathlib import Path

def print_cyan(text):
    print(f"[INFO] {text}")

def print_green(text):
    print(f"[SUCCESS] {text}")

def print_red(text):
    print(f"[ERROR] {text}")

def build_frontend():
    print_cyan("Compiling web dashboard frontend...")
    web_dir = Path("web")
    if not web_dir.exists():
        print_cyan("WARNING: Web directory not found, skipping frontend build.")
        return True
    
    try:
        print_cyan("Running 'npm install' inside web/...")
        subprocess.run("npm install", shell=True, cwd=web_dir, check=True)
        print_cyan("Running 'npm run build' inside web/...")
        subprocess.run("npm run build", shell=True, cwd=web_dir, check=True)
        print_green("Frontend built successfully.")
        return True
    except subprocess.CalledProcessError as e:
        print_red(f"Frontend build failed: {e}")
        return False

def zip_project():
    print_cyan("Packaging repository into accessimind-agent.zip...")
    output_filename = "accessimind-agent.zip"
    
    exclude_dirs = {
        ".git",
        "venv",
        "node_modules",
        "web/node_modules",
        ".ruff_cache",
        "__pycache__",
        ".plans",
        "web/dist"
    }
    
    exclude_files = {
        ".env",
        "accessimind-agent.zip"
    }
    
    root_path = Path(".").resolve()
    
    try:
        with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(root_path):
                rel_root = Path(root).relative_to(root_path)
                
                parts = rel_root.parts
                should_exclude_dir = False
                for p in parts:
                    if p in exclude_dirs:
                        should_exclude_dir = True
                        break
                
                rel_root_str = rel_root.as_posix()
                if any(rel_root_str.startswith(ed) for ed in exclude_dirs):
                    should_exclude_dir = True
                
                if should_exclude_dir:
                    continue
                
                for file in files:
                    file_path = Path(root) / file
                    rel_file = file_path.relative_to(root_path)
                    rel_file_str = rel_file.as_posix()
                    
                    if file in exclude_files or rel_file_str in exclude_files:
                        continue
                    if any(p in exclude_dirs for p in rel_file.parts):
                        continue
                        
                    zipf.write(file_path, rel_file)
                    
        print_green(f"Created {output_filename} successfully!")
        size_mb = os.path.getsize(output_filename) / (1024 * 1024)
        print_green(f"Package size: {size_mb:.2f} MB")
        return True
    except Exception as e:
        print_red(f"Failed to create zip package: {e}")
        return False

def main():
    print_cyan("==================================================")
    print_cyan(" AccessiMind Commercial Packaging Script ")
    print_cyan("==================================================")
    
    if not build_frontend():
        print_red("Aborting packaging due to frontend compilation failure.")
        sys.exit(1)
        
    if not zip_project():
        sys.exit(1)
        
    print_green("Packaging completed successfully! AccessiMind is ready for commercial distribution.")

if __name__ == "__main__":
    main()
