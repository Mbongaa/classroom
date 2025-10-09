"""Test configuration to verify environment variables are set correctly"""

from config import config

print('\n🧪 Testing Configuration...\n')

# Print configuration
config.print_config()

# Validate
errors = config.validate()

if errors:
    print(f'\n❌ Configuration validation FAILED!')
    print(f'Errors:')
    for error in errors:
        print(f'  - {error}')
    exit(1)
else:
    print(f'\n✅ Configuration is valid!')
    print(f'\nYou can now run: python agent.py dev')
