"""
Data Manager Module
Handles saving and loading of models and results
"""

import json
import pickle
import os
from datetime import datetime
from typing import Any, Dict, Optional


class DataManager:
    """Manages data persistence for models and results"""
    
    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self.models_dir = os.path.join(base_dir, "models")
        self.results_dir = os.path.join(base_dir, "results")
        self.logs_dir = os.path.join(base_dir, "logs")
        
        # Create directories
        for directory in [self.models_dir, self.results_dir, self.logs_dir]:
            os.makedirs(directory, exist_ok=True)
    
    def save_model(self, model_data: Any, filename: Optional[str] = None) -> str:
        """
        Save model to file
        
        Args:
            model_data: Model data to save
            filename: Optional filename (will generate if not provided)
            
        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"model_{timestamp}.pkl"
        
        filepath = os.path.join(self.models_dir, filename)
        
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        
        return filepath
    
    def load_model(self, filename: str) -> Any:
        """Load model from file"""
        filepath = os.path.join(self.models_dir, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        
        return model_data
    
    def save_results(self, results: Dict[str, Any], filename: Optional[str] = None) -> str:
        """
        Save experiment results
        
        Args:
            results: Results dictionary
            filename: Optional filename
            
        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"results_{timestamp}.json"
        
        filepath = os.path.join(self.results_dir, filename)
        
        # Convert numpy arrays to lists for JSON serialization
        results_serializable = self._make_serializable(results)
        
        with open(filepath, 'w') as f:
            json.dump(results_serializable, f, indent=2)
        
        return filepath
    
    def load_results(self, filename: str) -> Dict[str, Any]:
        """Load results from file"""
        filepath = os.path.join(self.results_dir, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Results file not found: {filepath}")
        
        with open(filepath, 'r') as f:
            results = json.load(f)
        
        return results
    
    def _make_serializable(self, obj: Any) -> Any:
        """Convert object to JSON-serializable format"""
        import numpy as np
        
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        else:
            return obj
    
    def list_models(self) -> list:
        """List all saved models"""
        if not os.path.exists(self.models_dir):
            return []
        
        models = [f for f in os.listdir(self.models_dir) if f.endswith('.pkl')]
        return sorted(models, reverse=True)
    
    def list_results(self) -> list:
        """List all saved results"""
        if not os.path.exists(self.results_dir):
            return []
        
        results = [f for f in os.listdir(self.results_dir) if f.endswith('.json')]
        return sorted(results, reverse=True)
    
    def get_latest_model(self) -> Optional[str]:
        """Get the most recent model filename"""
        models = self.list_models()
        return models[0] if models else None
    
    def delete_old_models(self, keep_n: int = 5):
        """Delete old models, keeping only the most recent N"""
        models = self.list_models()
        
        if len(models) > keep_n:
            for model in models[keep_n:]:
                filepath = os.path.join(self.models_dir, model)
                os.remove(filepath)