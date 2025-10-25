import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/empty-state';
import { Truck } from 'lucide-react';

describe('EmptyState', () => {
  it('should render title and description', () => {
    render(
      <EmptyState
        icon={Truck}
        title="No trucks found"
        description="Add your first truck to get started"
      />
    );

    expect(screen.getByText('No trucks found')).toBeInTheDocument();
    expect(screen.getByText('Add your first truck to get started')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const handleClick = jest.fn();
    
    render(
      <EmptyState
        icon={Truck}
        title="No trucks found"
        description="Add your first truck to get started"
        action={{ label: 'Add Truck', onClick: handleClick }}
      />
    );

    const button = screen.getByText('Add Truck');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when not provided', () => {
    render(
      <EmptyState
        icon={Truck}
        title="No trucks found"
        description="Add your first truck to get started"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
