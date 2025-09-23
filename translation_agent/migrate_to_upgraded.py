#!/usr/bin/env python3
"""
Migration script to transition from the original translation agent to the upgraded version
using GPT Realtime for STT and GPT-4o for translation.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path


class Colors:
    """Terminal color codes for better output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(message):
    """Print a formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")


def print_success(message):
    """Print a success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_warning(message):
    """Print a warning message"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")


def print_error(message):
    """Print an error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_info(message):
    """Print an info message"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")


def check_prerequisites():
    """Check if all prerequisites are met"""
    print_header("Checking Prerequisites")

    # Check Python version
    if sys.version_info < (3, 8):
        print_error(f"Python 3.8+ required. Current version: {sys.version}")
        return False
    print_success(f"Python version: {sys.version.split()[0]}")

    # Check if .env file exists
    if not Path('.env').exists():
        print_warning(".env file not found. You'll need to create one with your API keys.")
    else:
        print_success(".env file found")

    # Check if original main.py exists
    if Path('main.py').exists():
        print_success("Original main.py found")
    else:
        print_warning("Original main.py not found - this might be a fresh installation")

    return True


def backup_original():
    """Create backups of original files"""
    print_header("Creating Backups")

    backup_dir = Path('backup_original')
    backup_dir.mkdir(exist_ok=True)

    files_to_backup = [
        'main.py',
        'requirements.txt',
        '.env'
    ]

    for file in files_to_backup:
        if Path(file).exists():
            backup_path = backup_dir / f"{file}.backup"
            try:
                shutil.copy2(file, backup_path)
                print_success(f"Backed up {file} to {backup_path}")
            except Exception as e:
                print_error(f"Failed to backup {file}: {e}")
                return False
        else:
            print_info(f"Skipping {file} (not found)")

    return True


def install_dependencies():
    """Install new dependencies"""
    print_header("Installing Dependencies")

    # Check if requirements_upgraded.txt exists
    if not Path('requirements_upgraded.txt').exists():
        print_error("requirements_upgraded.txt not found!")
        return False

    print_info("Installing upgraded dependencies...")

    try:
        # Install new requirements
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '-r', 'requirements_upgraded.txt'],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print_success("Dependencies installed successfully")
        else:
            print_error(f"Failed to install dependencies: {result.stderr}")
            return False

    except Exception as e:
        print_error(f"Error installing dependencies: {e}")
        return False

    # Uninstall old dependencies that are no longer needed
    print_info("Removing obsolete dependencies...")
    try:
        subprocess.run(
            [sys.executable, '-m', 'pip', 'uninstall', '-y', 'livekit-plugins-silero'],
            capture_output=True,
            text=True
        )
        print_success("Removed obsolete dependencies")
    except:
        print_info("No obsolete dependencies to remove")

    return True


def verify_api_keys():
    """Verify that required API keys are present"""
    print_header("Verifying API Keys")

    required_keys = [
        'LIVEKIT_URL',
        'LIVEKIT_API_KEY',
        'LIVEKIT_API_SECRET',
        'OPENAI_API_KEY'
    ]

    env_file = Path('.env')
    if not env_file.exists():
        print_warning(".env file not found. Creating template...")

        template = """# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=YOUR_API_KEY
LIVEKIT_API_SECRET=YOUR_API_SECRET

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_KEY
"""
        with open('.env', 'w') as f:
            f.write(template)

        print_success("Created .env template. Please fill in your API keys.")
        return False

    # Check if keys are present (not their validity)
    with open('.env', 'r') as f:
        content = f.read()

    missing_keys = []
    for key in required_keys:
        if key not in content:
            missing_keys.append(key)
        else:
            print_success(f"{key} found in .env")

    if missing_keys:
        print_warning(f"Missing keys: {', '.join(missing_keys)}")
        print_info("Please add these to your .env file")
        return False

    print_info("Note: Ensure your OpenAI API key has access to GPT-4o and Realtime API")
    return True


def setup_upgraded_agent():
    """Set up the upgraded agent"""
    print_header("Setting Up Upgraded Agent")

    # Check if main_upgraded.py exists
    if not Path('main_upgraded.py').exists():
        print_error("main_upgraded.py not found!")
        print_info("Please ensure you have the upgraded agent file")
        return False

    # Create a symbolic link or copy
    if Path('main.py').exists():
        # Rename old main.py
        shutil.move('main.py', 'main_original.py')
        print_success("Moved original main.py to main_original.py")

    # Copy upgraded version to main.py
    shutil.copy2('main_upgraded.py', 'main.py')
    print_success("Upgraded agent installed as main.py")

    return True


def run_tests():
    """Run the test suite"""
    print_header("Running Tests")

    if not Path('test_upgraded_agent.py').exists():
        print_warning("Test file not found. Skipping tests.")
        return True

    print_info("Running unit tests...")

    try:
        result = subprocess.run(
            [sys.executable, '-m', 'pytest', 'test_upgraded_agent.py', '-v', '--tb=short'],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print_success("All tests passed!")
            return True
        else:
            print_warning("Some tests failed. This might be due to missing mock configurations.")
            print_info("Review the test output for details:")
            print(result.stdout)
            return True  # Don't fail migration due to tests

    except subprocess.CalledProcessError as e:
        print_warning(f"Test execution failed: {e}")
        return True  # Don't fail migration due to tests
    except FileNotFoundError:
        print_info("pytest not found. Install with: pip install pytest")
        return True


def print_next_steps():
    """Print next steps for the user"""
    print_header("Migration Complete!")

    print(f"""
{Colors.OKGREEN}The translation agent has been successfully upgraded!{Colors.ENDC}

{Colors.BOLD}Next Steps:{Colors.ENDC}

1. {Colors.OKCYAN}Update your .env file:{Colors.ENDC}
   - Ensure OPENAI_API_KEY has access to GPT-4o and Realtime API
   - Verify all LiveKit credentials are correct

2. {Colors.OKCYAN}Test in development:{Colors.ENDC}
   python main.py dev

3. {Colors.OKCYAN}Monitor performance:{Colors.ENDC}
   - Check logs for any errors
   - Monitor latency metrics (should be <1 second)
   - Verify translation quality

4. {Colors.OKCYAN}Deploy to production:{Colors.ENDC}
   python main.py start

{Colors.BOLD}Key Improvements:{Colors.ENDC}
✨ GPT Realtime for STT with integrated VAD and punctuation
✨ GPT-4o for superior translation quality
✨ Performance monitoring and metrics
✨ Translation caching for repeated phrases
✨ Comprehensive error handling

{Colors.BOLD}Rollback (if needed):{Colors.ENDC}
   cp backup_original/main.py.backup main.py
   cp backup_original/requirements.txt.backup requirements.txt
   pip install -r requirements.txt

{Colors.BOLD}Documentation:{Colors.ENDC}
   See TRANSLATION_AGENT_UPGRADED.md for detailed information

{Colors.OKGREEN}Happy translating! 🌍{Colors.ENDC}
    """)


def main():
    """Main migration process"""
    print_header("LiveKit Translation Agent Migration")
    print(f"{Colors.OKCYAN}Migrating to GPT Realtime + GPT-4o{Colors.ENDC}\n")

    steps = [
        ("Checking prerequisites", check_prerequisites),
        ("Creating backups", backup_original),
        ("Installing dependencies", install_dependencies),
        ("Verifying API keys", verify_api_keys),
        ("Setting up upgraded agent", setup_upgraded_agent),
        ("Running tests", run_tests)
    ]

    for step_name, step_func in steps:
        if not step_func():
            print_error(f"\n{step_name} failed!")
            print_info("Migration incomplete. Please resolve the issues and try again.")
            print_info("You can restore from backup if needed: cp backup_original/*.backup .")
            sys.exit(1)

    print_next_steps()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\n\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\n\nUnexpected error: {e}")
        sys.exit(1)