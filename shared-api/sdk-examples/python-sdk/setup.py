"""
Setup configuration for TMI Python SDK.
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="tmi-client",
    version="0.1.0",
    author="TMI Development Team",
    author_email="dev@tmi.com",
    description="Python SDK for the Collaborative Threat Modeling Interface (TMI) API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/tmi-python-sdk",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Security",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
        "websocket-client>=1.3.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-asyncio",
            "black",
            "isort",
            "mypy",
            "flake8",
        ],
    },
    entry_points={
        "console_scripts": [
            "tmi-cli=tmi_client.cli:main",
        ],
    },
)